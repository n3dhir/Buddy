import { card, eyebrow } from "../ui";

export default function Stat({ label, value, suffix, tone }: { label: string; value: string; suffix?: string; tone?: string }) {
  return (
    <div className={`${card} p-5`}>
      <p className={eyebrow}>{label}</p>
      <p className={`tnum mt-2 text-2xl font-semibold tracking-tight sm:text-[28px] ${tone ?? "text-ink"}`}>
        {value}
        {suffix && <span className="ml-1.5 text-sm font-normal text-ink-tertiary">{suffix}</span>}
      </p>
    </div>
  );
}
