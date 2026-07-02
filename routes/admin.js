const express = require("express");
const bcrypt = require("bcryptjs");
const database = require("../db/db");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const { ensureVonageUserExists } = require("../services/vonageClient");

const router = express.Router();
router.use(requireAuth, requireAdmin);

function sanitizeAgent(agent) {
  const { passwordHash, ...remainingFields } = agent;
  return remainingFields;
}

router.get("/agents", (request, response) => {
  response.json(database.read().agents.map(sanitizeAgent));
});

router.post("/agents", async (request, response) => {
  const { username, name, password, role } = request.body || {};
  if (!username || !name || !password) {
    return response.status(400).json({ error: "Utilizator, nume si parola sunt obligatorii." });
  }
  const data = database.read();
  if (data.agents.some((existingAgent) => existingAgent.username.toLowerCase() === username.toLowerCase())) {
    return response.status(409).json({ error: "Exista deja un agent cu acest nume de utilizator." });
  }
  const newAgent = {
    id: Date.now().toString(36),
    username,
    name,
    role: role === "admin" ? "admin" : "agent",
    passwordHash: bcrypt.hashSync(password, 10),
    status: "offline",
    busyMinutes: null,
    busyUntil: null,
  };
  await database.update((data) => data.agents.push(newAgent));
  await ensureVonageUserExists(username, name);
  response.json(sanitizeAgent(newAgent));
});

router.put("/agents/:id", async (request, response) => {
  const { name, role, password } = request.body || {};
  const updatedAgent = await database.update((data) => {
    const agent = data.agents.find((existingAgent) => existingAgent.id === request.params.id);
    if (!agent) return null;
    if (name) agent.name = name;
    if (role) agent.role = role === "admin" ? "admin" : "agent";
    if (password) agent.passwordHash = bcrypt.hashSync(password, 10);
    return agent;
  });
  if (!updatedAgent) return response.status(404).json({ error: "Agent inexistent." });
  response.json(sanitizeAgent(updatedAgent));
});

router.delete("/agents/:id", async (request, response) => {
  if (request.params.id === request.user.id) {
    return response.status(400).json({ error: "Nu te poti sterge pe tine insuti." });
  }
  await database.update((data) => {
    data.agents = data.agents.filter((existingAgent) => existingAgent.id !== request.params.id);
  });
  response.json({ ok: true });
});

router.get("/calls", (request, response) => {
  const data = database.read();
  response.json(
    data.callLogs
      .slice()
      .sort((firstLog, secondLog) => secondLog.startedAt - firstLog.startedAt)
      .slice(0, 500)
  );
});

router.get("/stats", (request, response) => {
  const data = database.read();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const callsToday = data.callLogs.filter((callLog) => callLog.startedAt >= startOfDay.getTime());
  const completedCalls = callsToday.filter((callLog) => callLog.duration != null);
  const averageDurationSeconds = completedCalls.length
    ? Math.round(
        completedCalls.reduce((totalDuration, callLog) => totalDuration + (callLog.duration || 0), 0) /
          completedCalls.length
      )
    : 0;
  response.json({
    callsToday: callsToday.length,
    missedToday: callsToday.filter((callLog) => ["no-answer", "busy", "failed", "unanswered"].includes(callLog.status)).length,
    avgDurationSeconds: averageDurationSeconds,
    agentsOnline: data.agents.filter((agent) => agent.status !== "offline").length,
    agentsAvailable: data.agents.filter((agent) => agent.status === "available").length,
    smsToday: Object.values(data.smsThreads).reduce(
      (totalMessages, messageList) =>
        totalMessages + messageList.filter((message) => message.at >= startOfDay.getTime()).length,
      0
    ),
    emailsToday: data.emailLog.filter((emailEntry) => emailEntry.at >= startOfDay.getTime()).length,
  });
});

module.exports = router;
