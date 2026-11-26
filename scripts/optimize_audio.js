const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const apply = process.argv.includes("--apply");
const ffmpeg = "ffmpeg";
const audioDirectory = path.join(process.cwd(), "public", "audio");
const tempDirectory = path.join(process.cwd(), "data", ".optimized-audio");

fs.mkdirSync(tempDirectory, { recursive: true });

const mp3Files = fs
  .readdirSync(audioDirectory)
  .filter((file) => file.toLowerCase().endsWith(".mp3"))
  .map((file) => path.join(audioDirectory, file));

let beforeBytes = 0;
let afterBytes = 0;
let failed = 0;

for (const source of mp3Files) {
  beforeBytes += fs.statSync(source).size;
  const temp = path.join(tempDirectory, path.basename(source));
  const result = spawnSync(
    ffmpeg,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      source,
      "-codec:a",
      "libmp3lame",
      "-b:a",
      "128k",
      "-map_metadata",
      "0",
      temp,
    ],
    { stdio: "inherit" },
  );
  if (result.status !== 0 || !fs.existsSync(temp)) {
    failed++;
    continue;
  }
  afterBytes += fs.statSync(temp).size;
  if (apply) {
    fs.renameSync(temp, source);
  }
}

if (!apply) {
  fs.rmSync(tempDirectory, { recursive: true, force: true });
  console.log(
    `Dry run complete. Estimated savings: ${(
      (beforeBytes - afterBytes) /
      1024 /
      1024
    ).toFixed(1)} MB; ${failed} failed.`,
  );
} else {
  fs.rmSync(tempDirectory, { recursive: true, force: true });
  console.log(
    `Optimized ${mp3Files.length - failed} MP3 files. Estimated savings: ${(
      (beforeBytes - afterBytes) /
      1024 /
      1024
    ).toFixed(1)} MB.`,
  );
}
