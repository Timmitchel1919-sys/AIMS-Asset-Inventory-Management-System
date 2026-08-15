import { spawnSync } from "node:child_process";

const environment = { ...process.env };
delete environment.DEBUG;

const isWindows = process.platform === "win32";
const arguments_ = [
      "-y",
      "firebase-tools@latest",
      "emulators:exec",
      "--only",
      "auth",
      "node scripts/auth-emulator-smoke.mjs",
    ];
const options = { env: environment, stdio: "inherit" };
const result = isWindows
  ? spawnSync(
      'npx.cmd -y firebase-tools@latest emulators:exec --only auth "node scripts/auth-emulator-smoke.mjs"',
      { ...options, shell: true },
    )
  : spawnSync("npx", arguments_, options);

if (result.error) throw result.error;
process.exit(result.status ?? 1);
