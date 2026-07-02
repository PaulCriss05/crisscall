require("dotenv").config();
const path = require("path");
const express = require("express");
const http = require("http");
const cookieParser = require("cookie-parser");
const { Server } = require("socket.io");

const application = express();
const httpServer = http.createServer(application);
const socketServer = new Server(httpServer);

application.set("io", socketServer);
application.use(express.json());
application.use(express.urlencoded({ extended: true }));
application.use(cookieParser());

application.use("/webhooks", require("./routes/webhooks"));

application.use("/api/auth", require("./routes/auth"));
application.use("/api/contacts", require("./routes/contacts"));
application.use("/api/sms", require("./routes/sms"));
application.use("/api/email", require("./routes/email"));
application.use("/api/admin", require("./routes/admin"));
application.use("/api/settings", require("./routes/settings"));
application.use("/api/voice", require("./routes/voice"));

application.use(express.static(path.join(__dirname, "public")));

application.get("/health", (request, response) => response.json({ ok: true, time: Date.now() }));

socketServer.on("connection", (clientSocket) => {
  clientSocket.on("disconnect", () => {});
});

const serverPort = process.env.PORT || 3000;
httpServer.listen(serverPort, () => {
  console.log(`CrissCall pornit pe http://localhost:${serverPort}`);
  console.log(`Autentificare initiala: admin / admin123 (schimba parola din tab-ul Admin!)`);
});
