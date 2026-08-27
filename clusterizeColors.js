const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const COLLECTION_NAME = "pokemons";

const FIRST_ID = 1;
const LAST_ID = 649;

// Maximum CIE94 color difference for two colors to belong to the same cluster.
const COLOR_DISTANCE_THRESHOLD = 8;

// Run with:
//   node script.js --dry-run
//
// Dry run performs all calculations but does not
// modify Firestore.
const DRY_RUN = process.argv.includes("--dry-run");

function hexToRgb(hex) {
  hex = hex.replace("#", "");
  return {
    r: parseInt(hex.substring(0, 2), 16),
    g: parseInt(hex.substring(2, 4), 16),
    b: parseInt(hex.substring(4, 6), 16),
  };
}

function rgbToHex(r, g, b) {
  return (
    "#" +
    [r, g, b]
      .map((value) => Math.round(value).toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()
  );
}

function rgbToLab({ r, g, b }) {
  r /= 255;
  g /= 255;
  b /= 255;

  r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const y = (r * 0.2126 + g * 0.3576 + b * 0.0722) / 1.0;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;

  const f = (value) =>
    value > 0.008856 ? Math.pow(value, 1 / 3) : 7.787 * value + 16 / 116;

  const fx = f(x);
  const fy = f(y);
  const fz = f(z);

  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

function labToRgb({ L, a, b }) {
  let fy = (L + 16) / 116;
  let fx = a / 500 + fy;
  let fz = fy - b / 200;

  const f = (value) => {
    const value3 = Math.pow(value, 3);
    return value3 > 0.008856 ? value3 : (value - 16 / 116) / 7.787;
  };

  const x = 0.95047 * f(fx);
  const y = 1.0 * f(fy);
  const z = 1.08883 * f(fz);

  let r = x * 3.2406 + y * -1.5372 + z * -0.4986;
  let g = x * -0.9689 + y * 1.8758 + z * 0.0415;
  let blue = x * 0.0557 + y * -0.204 + z * 1.057;

  const gammaCorrect = (value) =>
    value > 0.0031308
      ? 1.055 * Math.pow(value, 1 / 2.4) - 0.055
      : 12.92 * value;

  r = gammaCorrect(r);
  g = gammaCorrect(g);
  blue = gammaCorrect(blue);

  return {
    r: Math.max(0, Math.min(255, r * 255)),
    g: Math.max(0, Math.min(255, g * 255)),
    b: Math.max(0, Math.min(255, blue * 255)),
  };
}

function colorDistance(color1, color2) {
  const deltaL = color1.L - color2.L;

  const c1 = Math.sqrt(color1.a * color1.a + color1.b * color1.b);
  const c2 = Math.sqrt(color2.a * color2.a + color2.b * color2.b);
  const deltaC = c1 - c2;

  const deltaA = color1.a - color2.a;
  const deltaB = color1.b - color2.b;

  const deltaH2 = Math.max(
    0,
    deltaA * deltaA + deltaB * deltaB - deltaC * deltaC,
  );
  const deltaH = Math.sqrt(deltaH2);

  const kL = 1;
  const kC = 1;
  const kH = 1;
  const K1 = 0.045;
  const K2 = 0.015;

  const lightnessTerm = deltaL / kL;
  const chromaTerm = deltaC / (kC * (1 + K1 * c1));
  const hueTerm = deltaH / (kH * (1 + K2 * c1));

  return Math.sqrt(
    lightnessTerm * lightnessTerm + chromaTerm * chromaTerm + hueTerm * hueTerm,
  );
}

function clusterColors(colors) {
  const clusters = [];

  for (const color of colors) {
    let bestCluster = null;
    let bestDistance = Infinity;

    for (const cluster of clusters) {
      const maxDistance = Math.max(
        ...cluster.colors.map((existingColor) =>
          colorDistance(color.lab, existingColor.lab),
        ),
      );

      if (maxDistance < bestDistance) {
        bestDistance = maxDistance;
        bestCluster = cluster;
      }
    }

    if (bestCluster && bestDistance <= COLOR_DISTANCE_THRESHOLD) {
      bestCluster.colors.push(color);
      bestCluster.averageLab = calculateAverageLab(bestCluster.colors);
    } else {
      clusters.push({
        colors: [color],
        averageLab: {
          ...color.lab,
        },
      });
    }
  }

  return clusters;
}

function calculateAverageLab(colors) {
  const total = colors.reduce(
    (sum, color) => {
      sum.L += color.lab.L;
      sum.a += color.lab.a;
      sum.b += color.lab.b;
      return sum;
    },
    {
      L: 0,
      a: 0,
      b: 0,
    },
  );

  return {
    L: total.L / colors.length,
    a: total.a / colors.length,
    b: total.b / colors.length,
  };
}

async function main() {
  console.log("============================================================");
  console.log("Clustering Pokémon colors");
  console.log("============================================================");
  console.log(`Collection: ${COLLECTION_NAME}`);
  console.log(`Documents: ${FIRST_ID} -> ${LAST_ID}`);
  console.log("Color distance: CIE94");
  console.log(`Color distance threshold: ${COLOR_DISTANCE_THRESHOLD}`);
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "WRITE"}`);
  console.log("============================================================\n");

  if (DRY_RUN)
    console.log("DRY RUN enabled: Firestore will NOT be modified.\n");
  else
    console.log(
      "WRITE mode enabled: clustered colors WILL be written to Firestore.\n",
    );

  const pokemons = [];
  const allColors = [];

  for (let id = FIRST_ID; id <= LAST_ID; id++) {
    const docRef = db.collection(COLLECTION_NAME).doc(String(id));
    const doc = await docRef.get();
    if (!doc.exists) {
      console.log(`[${id}] Document does not exist`);
      continue;
    }
    const data = doc.data();

    if (!Array.isArray(data.colors) || data.colors.length === 0) {
      console.log(`[${id}] ${data.name} has no colors`);
      continue;
    }

    console.log(
      `[${id}/${LAST_ID}] Processing ${data.name} (${data.colors.length} colors)...`,
    );

    const colors = data.colors.map((hex) => ({
      hex,
      rgb: hexToRgb(hex),
      lab: rgbToLab(hexToRgb(hex)),
      pokemonId: id,
      pokemonName: data.name,
    }));

    pokemons.push({
      id,
      name: data.name,
      colors,
    });

    allColors.push(...colors);
  }

  console.log(`\nLoaded ${pokemons.length} Pokémon colors.`);
  const clusters = clusterColors(allColors);
  console.log(`Created ${clusters.length} color clusters.`);

  const results = clusters.map((cluster, index) => {
    const rgb = labToRgb(cluster.averageLab);
    const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
    return {
      cluster: index + 1,
      color: hex,
      size: cluster.colors.length,
      colors: cluster.colors,
    };
  });

  const filteredResults = results.filter((cluster) => {
    const uniquePokemon = new Set(
      cluster.colors.map((color) => color.pokemonId),
    );
    if (uniquePokemon.size < 2) return false;

    const clusterLab = rgbToLab(hexToRgb(cluster.color));

    const allColorsAreClose = cluster.colors.every((color) => {
      const distance = colorDistance(color.lab, clusterLab);
      return distance <= COLOR_DISTANCE_THRESHOLD;
    });
    if (!allColorsAreClose) return false;

    const transitions = new Set(
      cluster.colors.map(
        (color) =>
          `${color.hex.toUpperCase()} -> ${cluster.color.toUpperCase()}`,
      ),
    );
    return transitions.size >= 2;
  });

  filteredResults.sort((a, b) => b.size - a.size);

  console.log("\n============================================================");
  console.log("COLOR CLUSTERS");
  console.log("============================================================");

  filteredResults.forEach((cluster) => {
    console.log(
      `\nCluster ${cluster.cluster}: ${cluster.color} (${cluster.size} Pokémon)`,
    );

    for (const color of cluster.colors) {
      console.log(
        `  ID ${color.pokemonId}: ${color.pokemonName} - ${color.hex} -> ${cluster.color}`,
      );
    }
  });

  if (!DRY_RUN) {
    console.log(
      "\n============================================================",
    );
    console.log("WRITING COLORS TO FIRESTORE");
    console.log("============================================================");

    let batch = db.batch();
    let batchOperations = 0;
    let totalUpdated = 0;

    for (const cluster of filteredResults) {
      for (const pokemon of cluster.colors) {
        const docRef = db.collection(COLLECTION_NAME).doc(String(pokemon.id));

        batch.update(docRef, {
          color: cluster.color,
        });

        batchOperations++;
        totalUpdated++;

        if (batchOperations === 500) {
          await batch.commit();
          console.log(`Committed ${batchOperations} updates.`);
          batch = db.batch();
          batchOperations = 0;
        }
      }
    }

    if (batchOperations > 0) {
      await batch.commit();
      console.log(`Committed ${batchOperations} updates.`);
    }

    console.log(`\nUpdated ${totalUpdated} Pokémon documents.`);
  } else {
    console.log(
      "\n============================================================",
    );
    console.log("DRY RUN: NO FIRESTORE CHANGES MADE");
    console.log("============================================================");
    console.log(`Would update ${pokemons.length} Pokémon documents.`);
  }
  console.log("\n============================================================");
  console.log("DONE");
  console.log("============================================================");
}

main().catch((error) => {
  console.error("\nFATAL ERROR:");
  console.error(error);
  process.exit(1);
});
