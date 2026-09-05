// pm2 process file for the VPS. Copy to the server alongside the repo.
// Secrets (DATABASE_URL, RAFIQ_API_TOKEN) come from the server-side .env
// (loaded via dotenv) — never commit them here.
module.exports = {
  apps: [
    {
      name: "rafiq-web",
      script: "./dist/web.js",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
