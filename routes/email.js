const express = require("express");
const nodemailer = require("nodemailer");
const database = require("../db/db");
const { requireAuth } = require("../middleware/auth");
const { getSettings } = require("../services/vonageClient");

const router = express.Router();

router.get("/log", requireAuth, (request, response) => {
  const data = database.read();
  response.json(
    data.emailLog
      .slice()
      .sort((firstEntry, secondEntry) => secondEntry.at - firstEntry.at)
      .slice(0, 200)
  );
});

router.post("/send", requireAuth, async (request, response) => {
  const { to, subject, body } = request.body || {};
  if (!to || !subject || !body) {
    return response.status(400).json({ error: "Destinatar, subiect si continut sunt obligatorii." });
  }
  const settings = getSettings();
  if (!settings.smtpHost || !settings.smtpUser || !settings.smtpPass) {
    return response.status(400).json({ error: "Email-ul (SMTP) nu este configurat (vezi tab-ul Setari)." });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: settings.smtpHost,
      port: Number(settings.smtpPort) || 587,
      secure: Number(settings.smtpPort) === 465,
      auth: { user: settings.smtpUser, pass: settings.smtpPass },
    });
    await transporter.sendMail({
      from: settings.smtpFrom || settings.smtpUser,
      to,
      subject,
      text: body,
    });
    const newEntry = {
      id: Date.now().toString(36),
      to,
      subject,
      body,
      sentBy: request.user.username,
      at: Date.now(),
      status: "trimis",
    };
    await database.update((data) => data.emailLog.push(newEntry));
    response.json({ ok: true, entry: newEntry });
  } catch (error) {
    response.status(500).json({ error: "Trimiterea email-ului a esuat: " + error.message });
  }
});

module.exports = router;
