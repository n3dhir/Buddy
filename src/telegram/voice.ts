import { execFile } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// Voice notes -> text via local whisper.cpp. Optional front door:
// every failure degrades to "type it instead" — text/commands never
// depend on it. Telegram sends voice as Opus-in-OGG; whisper.cpp
// wants 16kHz mono WAV, hence the ffmpeg step.

export class VoiceUnavailable extends Error {}

function cfg() {
  return {
    bin: process.env.WHISPER_BIN ?? "/home/ubuntu/cloned-projects/whisper.cpp/build/bin/whisper-cli",
    model: process.env.WHISPER_MODEL ?? "/home/ubuntu/cloned-projects/whisper.cpp/models/ggml-small.bin",
    lang: process.env.WHISPER_LANG ?? "en",
    timeoutMs: Number(process.env.WHISPER_TIMEOUT_MS ?? 60000),
    maxSeconds: Number(process.env.VOICE_MAX_SECONDS ?? 120),
  };
}

function run(cmd, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = execFile(cmd, args, { timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        const reason = err.killed ? `timed out after ${timeoutMs}ms` : String(stderr || err.message).slice(-300);
        reject(new Error(reason));
        return;
      }
      resolve(String(stdout));
    });
    void child;
  });
}

// fileId: Telegram voice file_id. botToken: needed for the file API.
// durationSec: voice.duration from the update (pre-download length cap).
export async function transcribeVoice(fileId, botToken, durationSec): Promise<string> {
  const { bin, model, lang, timeoutMs, maxSeconds } = cfg();
  if (durationSec > maxSeconds) {
    throw new VoiceUnavailable(`Voice note too long (${durationSec}s > ${maxSeconds}s) — keep it short or type it.`);
  }
  let meta;
  try {
    const r = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
    meta = await r.json();
  } catch (e) {
    throw new VoiceUnavailable(`Couldn't fetch voice file (${e instanceof Error ? e.message : e})`);
  }
  if (!meta?.ok || !meta?.result?.file_path) {
    throw new VoiceUnavailable("Telegram wouldn't hand over the voice file — try again.");
  }
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "rafiq-voice-"));
  const ogg = path.join(dir, `in-${crypto.randomBytes(4).toString("hex")}.ogg`);
  const wav = path.join(dir, "in.wav");
  try {
    const dl = await fetch(`https://api.telegram.org/file/bot${botToken}/${meta.result.file_path}`);
    if (!dl.ok || !dl.body) throw new Error(`download HTTP ${dl.status}`);
    await fs.writeFile(ogg, Buffer.from(await dl.arrayBuffer()));
    try {
      await run("ffmpeg", ["-y", "-v", "error", "-i", ogg, "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", wav], 30000);
    } catch (e) {
      throw new VoiceUnavailable(`Audio conversion failed (${e instanceof Error ? e.message : e}) — is ffmpeg installed?`);
    }
    let out;
    try {
      out = await run(bin, ["-m", model, "-l", lang, "-f", wav, "--no-timestamps", "--no-prints"], timeoutMs);
    } catch (e) {
      throw new VoiceUnavailable(
        `Transcription failed (${e instanceof Error ? e.message : e}) — check WHISPER_BIN/WHISPER_MODEL.`,
      );
    }
    return String(out).trim();
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}
