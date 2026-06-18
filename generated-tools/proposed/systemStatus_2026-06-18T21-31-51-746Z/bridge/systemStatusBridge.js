import { execFileSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function runSystemStatusDryRun() {
  const scriptPath = path.resolve(__dirname, "../src/systemStatus.ps1");

  const output = execFileSync(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath, "-DryRun"],
    { encoding: "utf8" }
  ).trim().replace(/^\uFEFF/, "");

  return JSON.parse(output);
}

export { runSystemStatusDryRun };