const jwt = require("jsonwebtoken");

const SECRET = process.env.JWT_SECRET || "dev-secret-schimba-in-productie";

function signToken(agent) {
  return jwt.sign(
    { id: agent.id, username: agent.username, name: agent.name, role: agent.role },
    SECRET,
    { expiresIn: "12h" }
  );
}

function requireAuth(request, response, next) {
  const token = request.cookies && request.cookies.token;
  if (!token) return response.status(401).json({ error: "Neautentificat." });
  try {
    request.user = jwt.verify(token, SECRET);
    next();
  } catch (error) {
    return response.status(401).json({ error: "Sesiune invalida sau expirata." });
  }
}

function requireAdmin(request, response, next) {
  if (!request.user || request.user.role !== "admin") {
    return response.status(403).json({ error: "Acces permis doar administratorilor." });
  }
  next();
}

module.exports = { signToken, requireAuth, requireAdmin, SECRET };
