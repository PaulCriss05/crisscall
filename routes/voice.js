const express = require("express");
const database = require("../db/db");
const { requireAuth } = require("../middleware/auth");
const { getVonageClient, generateAgentVoiceToken, ensureVonageUserExists } = require("../services/vonageClient");

const router = express.Router();

function sanitizeAgent(agent) {
  return {
    id: agent.id,
    username: agent.username,
    name: agent.name,
    role: agent.role,
    status: agent.status,
    busyMinutes: agent.busyMinutes,
    busyUntil: agent.busyUntil,
  };
}

router.get("/token", requireAuth, async (request, response) => {
  try {
    await ensureVonageUserExists(request.user.username, request.user.name);
    const token = generateAgentVoiceToken(request.user.username);
    response.json({ token, identity: request.user.username });
  } catch (error) {
    response.status(400).json({ error: error.message });
  }
});

router.get("/agents", requireAuth, (request, response) => {
  const data = database.read();
  response.json(data.agents.map(sanitizeAgent));
});

router.post("/status", requireAuth, async (request, response) => {
  const { status, busyMinutes } = request.body || {};
  if (!["available", "busy", "offline"].includes(status)) {
    return response.status(400).json({ error: "Status invalid." });
  }
  const updatedAgent = await database.update((data) => {
    const agent = data.agents.find((currentAgent) => currentAgent.id === request.user.id);
    if (!agent) return null;
    agent.status = status;
    if (status === "busy") {
      const minutes = Number(busyMinutes) > 0 ? Number(busyMinutes) : data.settings.defaultBusyMinutes;
      agent.busyMinutes = minutes;
      agent.busyUntil = Date.now() + minutes * 60000;
    } else {
      agent.busyMinutes = null;
      agent.busyUntil = null;
    }
    return sanitizeAgent(agent);
  });
  if (!updatedAgent) return response.status(404).json({ error: "Agent inexistent." });

  const socketServer = request.app.get("io");
  socketServer.emit("agents:update", database.read().agents.map(sanitizeAgent));
  response.json(updatedAgent);
});

router.get("/queue", requireAuth, (request, response) => {
  const data = database.read();
  const waitingCalls = data.queue.map((entry) => ({
    callUuid: entry.callUuid,
    from: entry.from,
    contactName: entry.contactName,
    waitTimeSeconds: Math.floor((Date.now() - entry.enqueuedAt) / 1000),
  }));
  response.json({ queueSize: waitingCalls.length, calls: waitingCalls });
});

router.post("/queue/:callUuid/claim", requireAuth, async (request, response) => {
  const callUuid = request.params.callUuid;
  const vonageClient = getVonageClient();
  if (!vonageClient) {
    return response.status(400).json({ error: "Vonage nu este configurat complet (vezi tab-ul Setari)." });
  }

  const data = database.read();
  const queuedCall = data.queue.find((entry) => entry.callUuid === callUuid);
  if (!queuedCall) {
    return response.status(404).json({ error: "Acest apel nu mai este in asteptare." });
  }

  try {
    await vonageClient.voice.transferCallWithNCCO(callUuid, [
      {
        action: "connect",
        endpoint: [{ type: "app", user: request.user.username }],
      },
    ]);
    await database.update((freshData) => {
      freshData.queue = freshData.queue.filter((entry) => entry.callUuid !== callUuid);
      const matchedCallLog = freshData.callLogs.find((callLog) => callLog.callUuid === callUuid);
      if (matchedCallLog) matchedCallLog.agentUsername = request.user.username;
    });
    request.app.get("io").emit("call:update", { callUuid, status: "transferring" });
    response.json({ ok: true });
  } catch (error) {
    response.status(500).json({ error: "Preluarea apelului a esuat: " + error.message });
  }
});

router.get("/logs", requireAuth, (request, response) => {
  const data = database.read();
  const filteredLogs = data.callLogs
    .filter((callLog) => request.user.role === "admin" || callLog.agentUsername === request.user.username)
    .sort((firstLog, secondLog) => secondLog.startedAt - firstLog.startedAt)
    .slice(0, 200);
  response.json(filteredLogs);
});

module.exports = router;
