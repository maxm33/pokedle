const path = require("path");
const { initializeApp, applicationDefault } = require("firebase-admin/app");

function initializeFirebase(projectId) {
  initializeApp({
    credential: applicationDefault(),
    projectId,
  });
}

function createFirebaseConfig(env) {
  return {
    apiKey: env.API_KEY,
    authDomain: env.AUTH_DOMAIN,
    projectId: env.PROJECT_ID,
    storageBucket: env.STORAGE_BUCKET,
    messagingSenderId: env.MESSAGING_SENDER_ID,
    appId: env.APP_ID,
    measurementId: env.MEASUREMENT_ID,
  };
}

function resolveAxiosBundlePath() {
  return path.resolve(
    path.dirname(require.resolve("axios")),
    "..",
    "axios.min.js",
  );
}

module.exports = {
  createFirebaseConfig,
  initializeFirebase,
  resolveAxiosBundlePath,
};
