const fs = require("fs");
const path = require("path");

function countBackgroundImages(rootDirectory, directoryName) {
  return fs
    .readdirSync(path.join(rootDirectory, "public", "images", directoryName))
    .filter((file) => /\.(?:webp|png|jpe?g)$/i.test(file)).length;
}

module.exports = { countBackgroundImages };
