import { spawnSync } from "node:child_process";

const environment = { ...process.env };
delete environment.DEBUG;

const executable = process.platform === "win32" ? process.env.ComSpec ?? "cmd.exe" : "npx";
const firebaseArguments = [
  "-y",
  "firebase-tools@latest",
  "emulators:exec",
  "--project",
  "aims-rules-test",
  "--only",
  "firestore",
  "vitest run --config vitest.rules.config.ts --configLoader runner",
];
const args = process.platform === "win32"
  ? ["/d", "/s", "/c", "scripts\\run-firestore-rules.cmd"]
  : firebaseArguments;
const result = spawnSync(
  executable,
  args,
  { env: environment, stdio: "inherit" },
);

process.exit(result.status ?? 1);
