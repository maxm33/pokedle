const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const COLLECTION_NAME = "pokemons";

const FIRST_ID = 1;
const LAST_ID = 649;

const IGNORED_FIELDS = new Set(["name", "ID"]);

function createComparisonKey(data) {
  const filtered = {};

  for (const [key, value] of Object.entries(data)) {
    if (IGNORED_FIELDS.has(key)) continue;
    filtered[key] = value;
  }

  const sorted = Object.keys(filtered)
    .sort()
    .reduce((result, key) => {
      result[key] = filtered[key];
      return result;
    }, {});

  return JSON.stringify(sorted);
}

async function main() {
  console.log("============================================================");
  console.log("Checking Pokémon documents for duplicate properties");
  console.log("============================================================");
  console.log(`Collection: ${COLLECTION_NAME}`);
  console.log(`Documents: ${FIRST_ID} -> ${LAST_ID}`);
  console.log(`Ignoring fields: ${[...IGNORED_FIELDS].join(", ")}`);
  console.log("============================================================\n");

  const groups = new Map();

  for (let id = FIRST_ID; id <= LAST_ID; id++) {
    const docRef = db.collection(COLLECTION_NAME).doc(String(id));

    const doc = await docRef.get();

    if (!doc.exists) {
      console.log(`[${id}] Document does not exist`);
      continue;
    }

    const data = doc.data();

    const comparisonKey = createComparisonKey(data);

    if (!groups.has(comparisonKey)) groups.set(comparisonKey, []);

    groups.get(comparisonKey).push({
      documentId: String(id),
      name: data.name,
      data,
    });
  }

  const duplicateGroups = [];

  for (const documents of groups.values())
    if (documents.length > 1) duplicateGroups.push(documents);

  console.log("\n============================================================");
  console.log("RESULT");
  console.log("============================================================");
  console.log(`Unique property combinations: ${groups.size}`);
  console.log(`Duplicate groups: ${duplicateGroups.length}`);

  if (duplicateGroups.length === 0) {
    console.log("\nNo documents share identical properties.");
    console.log("============================================================");
    return;
  }

  duplicateGroups.forEach((documents, index) => {
    console.log(
      `\n------------------------------------------------------------`,
    );
    console.log(`DUPLICATE GROUP ${index + 1}`);
    console.log(`------------------------------------------------------------`);
    console.log(`Documents: ${documents.length}`);
    console.log(`Pokémon:`);

    for (const document of documents)
      console.log(`  ID ${document.documentId}: ${document.name}`);

    const sharedData = {};

    for (const [key, value] of Object.entries(documents[0].data))
      if (!IGNORED_FIELDS.has(key)) sharedData[key] = value;

    console.log("\nShared properties:");
    console.log(JSON.stringify(sharedData, null, 2));
  });

  console.log("\n============================================================");
  console.log("DONE");
  console.log("============================================================");
}

main().catch((error) => {
  console.error("\nFATAL ERROR:");
  console.error(error);
  process.exit(1);
});
