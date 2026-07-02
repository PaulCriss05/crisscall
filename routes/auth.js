const express = require("express");
const bcrypt = require("bcryptjs");
const database = require("../db/db");
const { signToken, requireAuth } = require("../middleware/auth");

const router = express.Router();

router.post("/login", (request, response) => {
  const { username, password } = request.body || {};
  if (!username || !password) {
    return response.status(400).json({ error: "Introduceti utilizator si parola." });
  }
  const data = database.read();
  const matchedAgent = data.agents.find(
    (agent) => agent.username.toLowerCase() === String(username).toLowerCase()
  );
  if (!matchedAgent || !bcrypt.compareSync(password, matchedAgent.passwordHash)) {
    return response.status(401).json({ error: "Utilizator sau parola incorecta." });
  }
  const token = signToken(matchedAgent);
  response.cookie("token", token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 12 * 60 * 60 * 1000,
  });
  response.json({
    id: matchedAgent.id,
    username: matchedAgent.username,
    name: matchedAgent.name,
    role: matchedAgent.role,
  });
});

router.post("/logout", (request, response) => {
  response.clearCookie("token");
  response.json({ ok: true });
});

router.get("/me", requireAuth, (request, response) => {
  response.json(request.user);
});

module.exports = router;
