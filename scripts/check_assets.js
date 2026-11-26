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

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

const publicDirectory = path.join(process.cwd(), "public");
const files = walk(publicDirectory);
const duplicateGroups = new Map();
let audioBytes = 0;

for (const file of files) {
  const bytes = fs.statSync(file).size;
  if (file.toLowerCase().endsWith(".mp3")) audioBytes += bytes;
  const hash = sha256(file);
  if (!duplicateGroups.has(hash)) duplicateGroups.set(hash, []);
  duplicateGroups.get(hash).push(file);
}

const duplicates = [...duplicateGroups.values()].filter(
  (group) => group.length > 1,
);
const companionDirectory = path.join(
  process.cwd(),
  "public",
  "images",
  "animations",
);
const companionCount = fs
  .readdirSync(companionDirectory)
  .filter((file) => file.toLowerCase().endsWith(".gif")).length;

let companionCatalogCount = 0;
try {
  companionCatalogCount = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "data", "shopCompanions.json"), "utf8"),
  ).length;
} catch (_) {
  console.error("Could not read the generated companion catalog.");
  process.exit(1);
}

if (companionCount !== companionCatalogCount) {
  console.error(
    `Companion mismatch: ${companionCount} GIF files, ${companionCatalogCount} catalog entries.`,
  );
  process.exit(1);
}

console.log(`Public assets: ${files.length}`);
console.log(`Audio size: ${(audioBytes / 1024 / 1024).toFixed(1)} MB`);
console.log(`Duplicate asset groups: ${duplicates.length}`);
for (const group of duplicates.slice(0, 20)) {
  const relativePaths = group.map((file) =>
    path.relative(process.cwd(), file).split(path.sep).join("/"),
  );
  console.log(`- ${relativePaths.join(", ")}`);
}
