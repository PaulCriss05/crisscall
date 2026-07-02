const express = require("express");
const database = require("../db/db");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth, requireAdmin);

router.get("/", (request, response) => {
  const data = database.read();
  const baseUrl = process.env.PUBLIC_BASE_URL || `${request.protocol}://${request.get("host")}`;
  response.json({
    settings: data.settings,
    webhookUrls: {
      voiceAnswerUrl: `${baseUrl}/webhooks/voice/answer`,
      voiceEventUrl: `${baseUrl}/webhooks/voice/event`,
      smsInboundUrl: `${baseUrl}/webhooks/sms/inbound`,
    },
  });
});

router.put("/", async (request, response) => {
  const allowedSettingKeys = [
    "vonageApiKey",
    "vonageApiSecret",
    "vonageApplicationId",
    "vonagePrivateKey",
    "vonagePhoneNumber",
    "smtpHost",
    "smtpPort",
    "smtpUser",
    "smtpPass",
    "smtpFrom",
    "defaultBusyMinutes",
    "queueName",
    "companyName",
  ];
  const updatedSettings = await database.update((data) => {
    for (const settingKey of allowedSettingKeys) {
      if (request.body[settingKey] !== undefined) {
        data.settings[settingKey] = request.body[settingKey];
      }
    }
    return data.settings;
  });
  response.json(updatedSettings);
});

module.exports = router;
