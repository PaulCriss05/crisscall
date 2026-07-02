const express = require("express");
const database = require("../db/db");
const { requireAuth } = require("../middleware/auth");
const { getVonageClient, getSettings } = require("../services/vonageClient");

const router = express.Router();

router.get("/threads", requireAuth, (request, response) => {
  const data = database.read();
  const threadList = Object.entries(data.smsThreads).map(([phoneNumber, messageList]) => {
    const matchedContact = data.contacts.find(
      (contact) => String(contact.phone).replace(/\s+/g, "") === phoneNumber.replace(/\s+/g, "")
    );
    const lastMessage = messageList[messageList.length - 1];
    return {
      phone: phoneNumber,
      contactName: matchedContact ? matchedContact.name : null,
      lastMessage: lastMessage ? lastMessage.body : "",
      lastAt: lastMessage ? lastMessage.at : 0,
      count: messageList.length,
    };
  });
  threadList.sort((firstThread, secondThread) => secondThread.lastAt - firstThread.lastAt);
  response.json(threadList);
});

router.get("/threads/:phone", requireAuth, (request, response) => {
  const data = database.read();
  const messageList = data.smsThreads[request.params.phone] || [];
  response.json(messageList);
});

router.post("/send", requireAuth, async (request, response) => {
  const { to, body } = request.body || {};
  if (!to || !body) {
    return response.status(400).json({ error: "Numar si mesaj sunt obligatorii." });
  }

  const vonageClient = getVonageClient();
  const settings = getSettings();
  if (!vonageClient || !settings.vonagePhoneNumber) {
    return response.status(400).json({ error: "Vonage nu este configurat complet (vezi tab-ul Setari)." });
  }

  try {
    await vonageClient.sms.send({ from: settings.vonagePhoneNumber, to, text: body });
    await database.update((data) => {
      if (!data.smsThreads[to]) data.smsThreads[to] = [];
      data.smsThreads[to].push({
        direction: "outbound",
        body,
        at: Date.now(),
        sentBy: request.user.username,
      });
    });
    request.app.get("io").emit("sms:new", { phone: to, body, at: Date.now() });
    response.json({ ok: true });
  } catch (error) {
    response.status(500).json({ error: "Trimiterea SMS a esuat: " + error.message });
  }
});

module.exports = router;
