const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const roots = ["app.js", "bin", "lib", "routes", "scripts", "test"];
let failed = false;

function visit(target) {
  const stat = fs.statSync(target);
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(target)) visit(path.join(target, entry));
    return;
  }
  if (!target.endsWith(".js")) return;
  const result = spawnSync(process.execPath, ["--check", target], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    failed = true;
    process.stderr.write(`${target}\n${result.stderr}`);
  }
}

for (const root of roots) if (fs.existsSync(root)) visit(root);
if (failed) process.exit(1);
console.log("JavaScript syntax checks passed.");
