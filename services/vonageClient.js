const { Auth } = require("@vonage/auth");
const { Vonage } = require("@vonage/server-sdk");
const { tokenGenerate } = require("@vonage/jwt");
const database = require("../db/db");

function getSettings() {
  return database.read().settings;
}

function getVonageClient() {
  const settings = getSettings();
  if (!settings.vonageApiKey || !settings.vonageApiSecret) {
    return null;
  }
  const auth = new Auth({
    apiKey: settings.vonageApiKey,
    apiSecret: settings.vonageApiSecret,
    applicationId: settings.vonageApplicationId || undefined,
    privateKey: settings.vonagePrivateKey || undefined,
  });
  return new Vonage(auth);
}

function generateAgentVoiceToken(agentUsername) {
  const settings = getSettings();
  if (!settings.vonageApplicationId || !settings.vonagePrivateKey) {
    throw new Error(
      "Aplicatia Vonage nu este configurata complet (Application ID / Private Key). Completeaza-le in tab-ul Setari."
    );
  }
  return tokenGenerate(settings.vonageApplicationId, settings.vonagePrivateKey, {
    subject: agentUsername,
    ttl: 23 * 60 * 60,
    acl: {
      paths: {
        "/*/users/**": {},
        "/*/conversations/**": {},
        "/*/sessions/**": {},
        "/*/devices/**": {},
        "/*/image/**": {},
        "/*/media/**": {},
        "/*/applications/**": {},
        "/*/push/**": {},
        "/*/knocking/**": {},
        "/*/legs/**": {},
      },
    },
  });
}

async function ensureVonageUserExists(agentUsername, agentDisplayName) {
  const vonageClient = getVonageClient();
  if (!vonageClient) return;
  try {
    await vonageClient.users.createUser({
      name: agentUsername,
      displayName: agentDisplayName,
    });
  } catch (error) {
    return;
  }
}

module.exports = {
  getSettings,
  getVonageClient,
  generateAgentVoiceToken,
  ensureVonageUserExists,
};
