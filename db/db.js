const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");

const DB_PATH = path.join(__dirname, "..", "data", "db.json");

function defaultData() {
  return {
    agents: [
      {
        id: "admin",
        username: "admin",
        name: "Administrator",
        role: "admin",
        passwordHash: bcrypt.hashSync("admin123", 10),
        status: "offline",
        busyMinutes: null,
        busyUntil: null,
      },
    ],
    contacts: [],
    smsThreads: {},
    emailLog: [],
    callLogs: [],
    queue: [],
    settings: {
      vonageApiKey: process.env.VONAGE_API_KEY || "",
      vonageApiSecret: process.env.VONAGE_API_SECRET || "",
      vonageApplicationId: process.env.VONAGE_APPLICATION_ID || "",
      vonagePrivateKey: process.env.VONAGE_PRIVATE_KEY || "",
      vonagePhoneNumber: process.env.VONAGE_PHONE_NUMBER || "",
      smtpHost: process.env.SMTP_HOST || "",
      smtpPort: process.env.SMTP_PORT || "587",
      smtpUser: process.env.SMTP_USER || "",
      smtpPass: process.env.SMTP_PASS || "",
      smtpFrom: process.env.SMTP_FROM || "",
      defaultBusyMinutes: 5,
      queueName: "support-queue",
      companyName: "CrissCall",
    },
  };
}

function ensureFile() {
  if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(defaultData(), null, 2));
  }
}

function read() {
  ensureFile();
  const raw = fs.readFileSync(DB_PATH, "utf-8");
  return JSON.parse(raw);
}

function write(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

let writeLock = Promise.resolve();
function update(mutatorFn) {
  writeLock = writeLock.then(() => {
    const data = read();
    const result = mutatorFn(data);
    write(data);
    return result;
  });
  return writeLock;
}

module.exports = { read, write, update, DB_PATH };
