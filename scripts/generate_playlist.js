const fs = require("fs");
const path = require("path");
const { readMp3Album } = require("../lib/id3Reader");

async function main() {
  const audioDirectory = path.join(process.cwd(), "public", "audio");
  const filenames = await fs.promises.readdir(audioDirectory);
  const tracks = await Promise.all(
    filenames
      .filter((filename) => /^\d-\d{2}\. .+\.mp3$/i.test(filename))
      .map(async (filename) => ({
        filename,
        title: filename
          .replace(/^\d-\d{2}\. /, "")
          .replace(/\.mp3$/i, ""),
        album:
          (await readMp3Album(path.join(audioDirectory, filename))) ||
          "Album unknown",
      })),
  );
  fs.writeFileSync(
    path.join(process.cwd(), "data", "audioPlaylist.json"),
    `${JSON.stringify(tracks, null, 2)}\n`,
  );
  console.log(`Generated playlist metadata for ${tracks.length} tracks.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
