const fs = require("fs");
const path = require("path");
const { readMp3Album } = require("./id3Reader");

function createAudioPlaylist(rootDirectory) {
  let promise;

  async function load() {
    if (!promise) {
      promise = (async () => {
        const generatedPlaylist = path.join(
          rootDirectory,
          "data",
          "audioPlaylist.json",
        );
        try {
          const cached = JSON.parse(
            await fs.promises.readFile(generatedPlaylist, "utf8"),
          );
          if (Array.isArray(cached)) return cached;
        } catch (_) {}
        const audioDirectory = path.join(rootDirectory, "public", "audio");
        const filenames = await fs.promises.readdir(audioDirectory);
        const numberedFilenames = filenames.filter((filename) =>
          /^\d-\d{2}\. .+\.mp3$/i.test(filename),
        );
        return Promise.all(
          numberedFilenames.map(async (filename) => ({
            filename,
            title: filename
              .replace(/^\d-\d{2}\. /, "")
              .replace(/\.mp3$/i, ""),
            album:
              (await readMp3Album(path.join(audioDirectory, filename))) ||
              "Album unknown",
          })),
        );
      })();
    }
    try {
      return await promise;
    } catch (error) {
      promise = undefined;
      throw error;
    }
  }

  return { load };
}

module.exports = createAudioPlaylist;
