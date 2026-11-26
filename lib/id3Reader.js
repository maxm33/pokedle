const fs = require("fs");

async function readMp3Album(filePath) {
  const file = await fs.promises.open(filePath, "r");
  try {
    const header = Buffer.alloc(10);
    const headerRead = await file.read(header, 0, header.length, 0);
    if (
      headerRead.bytesRead !== header.length ||
      header.toString("ascii", 0, 3) !== "ID3"
    )
      return "";

    const version = header[3];
    if (version < 2 || version > 4) return "";
    const tagSize =
      (header[6] << 21) |
      (header[7] << 14) |
      (header[8] << 7) |
      header[9];
    const tagData = Buffer.alloc(Math.min(tagSize, 1024 * 1024));
    const tagRead = await file.read(tagData, 0, tagData.length, header.length);
    const data = tagData.subarray(0, tagRead.bytesRead);
    let offset = 0;

    if (header[5] & 0x40) {
      const extendedSize =
        version === 4
          ? (data[0] << 21) |
            (data[1] << 14) |
            (data[2] << 7) |
            data[3]
          : data.readUInt32BE(0) + 4;
      offset += extendedSize;
    }

    while (offset < data.length) {
      const idLength = version === 2 ? 3 : 4;
      const frameHeaderLength = version === 2 ? 6 : 10;
      if (offset + frameHeaderLength > data.length) break;
      const frameId = data.toString("ascii", offset, offset + idLength);
      if (!frameId.trim()) break;
      const frameSize =
        version === 2
          ? data.readUIntBE(offset + 3, 3)
          : version === 4
            ? (data[offset + 4] << 21) |
              (data[offset + 5] << 14) |
              (data[offset + 6] << 7) |
              data[offset + 7]
            : data.readUInt32BE(offset + 4);
      const frameStart = offset + frameHeaderLength;
      const frameEnd = frameStart + frameSize;
      if (frameEnd > data.length) break;
      if (frameId === "TALB" || frameId === "TAL") {
        const encoding = data[frameStart];
        let text = data.subarray(frameStart + 1, frameEnd);
        if (encoding === 0)
          return text.toString("latin1").replace(/\0+$/g, "").trim();
        if (encoding === 2) {
          text = text.subarray(0, text.length - (text.length % 2));
          return Buffer.from(text)
            .swap16()
            .toString("utf16le")
            .replace(/\0+$/g, "")
            .trim();
        }
        if (encoding === 1 && text[0] === 0xfe && text[1] === 0xff) {
          text = text.subarray(2, text.length - ((text.length - 2) % 2));
          return Buffer.from(text)
            .swap16()
            .toString("utf16le")
            .replace(/\0+$/g, "")
            .trim();
        }
        if (encoding === 1 && text[0] === 0xff && text[1] === 0xfe)
          text = text.subarray(2);
        return text
          .toString(encoding === 1 ? "utf16le" : "utf8")
          .replace(/\0+$/g, "")
          .trim();
      }
      offset = frameEnd;
    }
    return "";
  } finally {
    await file.close();
  }
}

module.exports = { readMp3Album };
