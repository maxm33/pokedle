const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function walk(directory) {
  const entries = [];
  for (const name of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, name.name);
    if (name.isDirectory()) entries.push(...walk(fullPath));
    else entries.push(fullPath);
  }
  return entries;
}

const publicDirectory = path.join(process.cwd(), "public");
const files = walk(publicDirectory).map((file) => {
  const content = fs.readFileSync(file);
  return {
    path: "/" + path.relative(process.cwd(), file).split(path.sep).join("/"),
    bytes: content.length,
    sha256: crypto.createHash("sha256").update(content).digest("hex"),
  };
});

fs.writeFileSync(
  path.join(process.cwd(), "data", "assetManifest.json"),
  `${JSON.stringify(files, null, 2)}\n`,
);
console.log(`Generated manifest for ${files.length} public assets.`);
