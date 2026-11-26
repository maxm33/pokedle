const fs = require("fs");
const path = require("path");

const directory = path.join(process.cwd(), "public", "images", "animations");
const companionPrice = 2400;
const companions = fs
  .readdirSync(directory)
  .filter((file) => file.toLowerCase().endsWith(".gif"))
  .sort((a, b) => a.localeCompare(b))
  .map((file) => ({
    id: `companion-${file.slice(0, -4).toLowerCase()}`,
    name: file
      .slice(0, -4)
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase()),
    imageUrl: `/public/images/animations/${encodeURIComponent(file)}`,
    type: "companion",
    price: file.toLowerCase().endsWith("_shiny.gif")
      ? companionPrice * 2
      : companionPrice,
  }));

fs.writeFileSync(
  path.join(process.cwd(), "data", "shopCompanions.json"),
  `${JSON.stringify(companions, null, 2)}\n`,
);
console.log(`Generated companion catalog for ${companions.length} items.`);
