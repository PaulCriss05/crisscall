let currentUser = null;
let socketConnection = null;
let selectedThreadPhone = null;

document.getElementById("login-form").addEventListener("submit", async (submitEvent) => {
  submitEvent.preventDefault();
  const username = document.getElementById("login-username").value.trim();
  const password = document.getElementById("login-password").value;
  const errorElement = document.getElementById("login-error");
  errorElement.textContent = "";
  try {
    const loggedInUser = await api.post("/api/auth/login", { username, password });
    currentUser = loggedInUser;
    enterApplication();
  } catch (error) {
    errorElement.textContent = error.message;
  }
});

document.getElementById("logout-btn").addEventListener("click", async () => {
  await api.post("/api/auth/logout");
  location.reload();
});

async function tryAutoLogin() {
  try {
    currentUser = await api.get("/api/auth/me");
    enterApplication();
  } catch (error) {
    document.getElementById("login-screen").hidden = false;
  }
}

function enterApplication() {
  document.getElementById("login-screen").hidden = true;
  const applicationScreen = document.getElementById("app-screen");
  applicationScreen.hidden = false;
  document.getElementById("agent-name").textContent = currentUser.name + " (" + currentUser.username + ")";
  if (currentUser.role !== "admin") {
    document.querySelectorAll(".admin-only").forEach((adminElement) => {
      adminElement.classList.add("admin-hidden");
    });
  }
  connectSocket();
  VoiceModule.init(handleVoiceEvent);
  setupStatusSwitch();
  refreshTeam();
  refreshQueue();
  loadContacts();
  loadSmsThreads();
  loadEmailLog();
  if (currentUser.role === "admin") {
    loadAdmin();
    loadSettingsTab();
  }
  setInterval(refreshQueue, 6000);
  setInterval(refreshTeam, 8000);
}

document.querySelectorAll(".nav-btn").forEach((navigationButton) => {
  navigationButton.addEventListener("click", () => {
    document.querySelectorAll(".nav-btn").forEach((otherButton) => {
      otherButton.classList.remove("active");
    });
    navigationButton.classList.add("active");
    const targetTabName = navigationButton.dataset.tab;
    document.querySelectorAll(".tab-panel").forEach((tabPanel) => {
      tabPanel.classList.remove("active");
    });
    document.getElementById("tab-" + targetTabName).classList.add("active");
  });
});

function connectSocket() {
  socketConnection = io();

  socketConnection.on("call:incoming", () => {
    refreshQueue();
  });

  socketConnection.on("call:update", () => {
    refreshQueue();
    if (currentUser.role === "admin") {
      loadAdmin();
    }
  });

  socketConnection.on("agents:update", (updatedAgentList) => {
    renderTeam(updatedAgentList);
  });

  socketConnection.on("sms:new", (newMessage) => {
    loadSmsThreads();
    if (selectedThreadPhone === newMessage.phone) {
      openThread(newMessage.phone);
    }
  });
}

function handleVoiceEvent(eventType, eventPayload) {
  const deviceLedElement = document.getElementById("device-led");
  const deviceStatusTextElement = document.getElementById("device-status-text");

  if (eventType === "ready") {
    deviceLedElement.className = "led led-on";
    deviceStatusTextElement.textContent = "Linie conectata";
  }

  if (eventType === "offline") {
    deviceLedElement.className = "led led-off";
    deviceStatusTextElement.textContent = "Linie neconectata";
  }

  if (eventType === "error") {
    deviceLedElement.className = "led led-error";
    deviceStatusTextElement.textContent = "Eroare linie";
    console.error(eventPayload);
  }

  if (eventType === "incoming") {
    showActiveCall(eventPayload.from, true);
    document.getElementById("answer-btn").hidden = false;
  }

  if (eventType === "connected") {
    showActiveCall(null, false);
    document.getElementById("answer-btn").hidden = true;
  }

  if (eventType === "timer") {
    document.getElementById("active-call-timer").textContent = eventPayload;
  }

  if (eventType === "disconnected") {
    hideActiveCall();
    refreshQueue();
  }
}

function showActiveCall(callerNumber, isRinging) {
  document.getElementById("current-call-empty").hidden = true;
  const activeCallContainer = document.getElementById("current-call-active");
  activeCallContainer.hidden = false;
  if (callerNumber) {
    document.getElementById("active-call-number").textContent = callerNumber;
  }
  document.getElementById("active-call-timer").textContent = isRinging ? "Apel intrant..." : "00:00";
}

function hideActiveCall() {
  document.getElementById("current-call-active").hidden = true;
  document.getElementById("current-call-empty").hidden = false;
  document.getElementById("answer-btn").hidden = true;
}

document.getElementById("answer-btn").addEventListener("click", () => {
  VoiceModule.answer(handleVoiceEvent);
});

document.getElementById("hangup-btn").addEventListener("click", () => {
  VoiceModule.hangup();
});

function setupStatusSwitch() {
  document.querySelectorAll(".status-btn").forEach((statusButton) => {
    statusButton.addEventListener("click", async () => {
      const selectedStatus = statusButton.dataset.status;
      if (selectedStatus === "busy") {
        document.getElementById("busy-minutes-row").hidden = false;
        setActiveStatusButton(selectedStatus);
        return;
      }
      document.getElementById("busy-minutes-row").hidden = true;
      await api.post("/api/voice/status", { status: selectedStatus });
      setActiveStatusButton(selectedStatus);
    });
  });

  document.getElementById("busy-minutes-apply").addEventListener("click", async () => {
    const busyMinutes = Number(document.getElementById("busy-minutes-input").value) || 5;
    await api.post("/api/voice/status", { status: "busy", busyMinutes: busyMinutes });
  });
}

function setActiveStatusButton(activeStatus) {
  document.querySelectorAll(".status-btn").forEach((statusButton) => {
    statusButton.classList.toggle("is-active", statusButton.dataset.status === activeStatus);
  });
}

async function refreshTeam() {
  try {
    const agentList = await api.get("/api/voice/agents");
    renderTeam(agentList);
    const currentAgent = agentList.find((agent) => agent.username === currentUser.username);
    if (currentAgent) {
      setActiveStatusButton(currentAgent.status);
    }
  } catch (error) {}
}

function renderTeam(agentList) {
  const teamListElement = document.getElementById("team-list");
  teamListElement.innerHTML = "";
  agentList.forEach((agent) => {
    const listItem = document.createElement("li");
    const ledClassName =
      agent.status === "available" ? "led-on" : agent.status === "busy" ? "led-error" : "led-off";
    let extraLabel = "";
    if (agent.status === "busy" && agent.busyUntil) {
      const remainingMinutes = Math.max(0, Math.ceil((agent.busyUntil - Date.now()) / 60000));
      extraLabel = ` (ocupat ${remainingMinutes} min)`;
    }
    listItem.innerHTML = `<span class="led ${ledClassName}"></span> ${agent.name}${extraLabel}`;
    teamListElement.appendChild(listItem);
  });
}

async function refreshQueue() {
  try {
    const queueResponse = await api.get("/api/voice/queue");
    const queueSize = queueResponse.queueSize;
    const waitingCalls = queueResponse.calls;
    document.getElementById("queue-count").textContent = queueSize;
    const queueBoardElement = document.getElementById("queue-board");
    queueBoardElement.innerHTML = "";
    if (!waitingCalls.length) {
      queueBoardElement.innerHTML = '<div class="empty-state">Nu este nimeni in asteptare.</div>';
      return;
    }
    waitingCalls.forEach((waitingCall, callIndex) => {
      const portCard = document.createElement("div");
      portCard.className = "port-card";
      const waitMinutes = Math.floor((waitingCall.waitTimeSeconds || 0) / 60);
      const waitSeconds = (waitingCall.waitTimeSeconds || 0) % 60;
      portCard.innerHTML = `
        <span class="port-led"></span>
        <div class="port-label">LINIA ${callIndex + 1}</div>
        <div class="port-number">${escapeHtml(waitingCall.contactName || waitingCall.from || "?")}</div>
        <div class="port-wait">asteapta ${waitMinutes}m ${waitSeconds}s</div>
        <button data-action="pull">Preia apel</button>
      `;
      portCard.querySelector("button").addEventListener("click", async () => {
        try {
          await api.post("/api/voice/queue/" + encodeURIComponent(waitingCall.callUuid) + "/claim");
          refreshQueue();
        } catch (error) {
          alert(error.message);
        }
      });
      queueBoardElement.appendChild(portCard);
    });
  } catch (error) {}
}

document.getElementById("add-contact-btn").addEventListener("click", () => {
  openContactForm();
});

document.getElementById("contact-cancel-btn").addEventListener("click", () => {
  closeContactForm();
});

document.getElementById("contact-save-btn").addEventListener("click", saveContact);

function openContactForm(existingContact) {
  document.getElementById("contact-form-box").hidden = false;
  document.getElementById("contact-id").value = existingContact ? existingContact.id : "";
  document.getElementById("contact-name").value = existingContact ? existingContact.name : "";
  document.getElementById("contact-phone").value = existingContact ? existingContact.phone : "";
  document.getElementById("contact-email").value = existingContact ? existingContact.email : "";
  document.getElementById("contact-notes").value = existingContact ? existingContact.notes : "";
}

function closeContactForm() {
  document.getElementById("contact-form-box").hidden = true;
}

async function saveContact() {
  const contactId = document.getElementById("contact-id").value;
  const contactPayload = {
    name: document.getElementById("contact-name").value.trim(),
    phone: document.getElementById("contact-phone").value.trim(),
    email: document.getElementById("contact-email").value.trim(),
    notes: document.getElementById("contact-notes").value.trim(),
  };
  if (!contactPayload.name || !contactPayload.phone) {
    alert("Nume si telefon sunt obligatorii.");
    return;
  }
  if (contactId) {
    await api.put("/api/contacts/" + contactId, contactPayload);
  } else {
    await api.post("/api/contacts", contactPayload);
  }
  closeContactForm();
  loadContacts();
}

async function loadContacts() {
  const contactList = await api.get("/api/contacts");
  const contactsTableBody = document.getElementById("contacts-tbody");
  contactsTableBody.innerHTML = "";
  contactList.forEach((contact) => {
    const tableRow = document.createElement("tr");
    tableRow.innerHTML = `
      <td>${escapeHtml(contact.name)}</td>
      <td>${escapeHtml(contact.phone)}</td>
      <td>${escapeHtml(contact.email || "-")}</td>
      <td>${escapeHtml(contact.notes || "-")}</td>
      <td class="row-actions">
        <button class="icon-btn" data-action="sms">SMS</button>
        <button class="icon-btn" data-action="email">Email</button>
        <button class="icon-btn" data-action="edit">Editeaza</button>
        <button class="icon-btn" data-action="delete">Sterge</button>
      </td>`;
    tableRow.querySelector('[data-action="edit"]').addEventListener("click", () => {
      openContactForm(contact);
    });
    tableRow.querySelector('[data-action="delete"]').addEventListener("click", async () => {
      if (confirm("Sterg contactul " + contact.name + "?")) {
        await api.delete("/api/contacts/" + contact.id);
        loadContacts();
      }
    });
    tableRow.querySelector('[data-action="sms"]').addEventListener("click", () => {
      document.querySelector('[data-tab="sms"]').click();
      openThread(contact.phone);
    });
    tableRow.querySelector('[data-action="email"]').addEventListener("click", () => {
      document.querySelector('[data-tab="email"]').click();
      document.getElementById("email-to").value = contact.email || "";
    });
    contactsTableBody.appendChild(tableRow);
  });
}

document.getElementById("sms-new-btn").addEventListener("click", () => {
  const newPhoneNumber = document.getElementById("sms-new-number").value.trim();
  if (newPhoneNumber) {
    openThread(newPhoneNumber);
  }
});

document.getElementById("sms-send-btn").addEventListener("click", sendSms);

async function loadSmsThreads() {
  const threadList = await api.get("/api/sms/threads");
  const threadListElement = document.getElementById("sms-thread-list");
  threadListElement.innerHTML = "";
  threadList.forEach((thread) => {
    const listItem = document.createElement("li");
    listItem.className = thread.phone === selectedThreadPhone ? "active" : "";
    listItem.innerHTML = `<div class="thread-phone">${escapeHtml(
      thread.contactName || thread.phone
    )}</div><div class="thread-preview">${escapeHtml(thread.lastMessage)}</div>`;
    listItem.addEventListener("click", () => {
      openThread(thread.phone);
    });
    threadListElement.appendChild(listItem);
  });
}

async function openThread(phoneNumber) {
  selectedThreadPhone = phoneNumber;
  document.getElementById("sms-conv-header").textContent = phoneNumber;
  const messageList = await api.get("/api/sms/threads/" + encodeURIComponent(phoneNumber));
  const messagesContainer = document.getElementById("sms-messages");
  messagesContainer.innerHTML = "";
  messageList.forEach((message) => {
    const bubbleElement = document.createElement("div");
    bubbleElement.className = "sms-bubble " + message.direction;
    bubbleElement.textContent = message.body;
    messagesContainer.appendChild(bubbleElement);
  });
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  loadSmsThreads();
}

async function sendSms() {
  if (!selectedThreadPhone) {
    alert("Selecteaza mai intai o conversatie.");
    return;
  }
  const messageInput = document.getElementById("sms-input");
  const messageBody = messageInput.value.trim();
  if (!messageBody) return;
  messageInput.value = "";
  try {
    await api.post("/api/sms/send", { to: selectedThreadPhone, body: messageBody });
    openThread(selectedThreadPhone);
  } catch (error) {
    alert(error.message);
  }
}

document.getElementById("email-send-btn").addEventListener("click", async () => {
  const recipientAddress = document.getElementById("email-to").value.trim();
  const emailSubject = document.getElementById("email-subject").value.trim();
  const emailBody = document.getElementById("email-body").value.trim();
  const resultElement = document.getElementById("email-result");
  try {
    await api.post("/api/email/send", { to: recipientAddress, subject: emailSubject, body: emailBody });
    resultElement.textContent = "Email trimis cu succes.";
    resultElement.style.color = "var(--available)";
    document.getElementById("email-subject").value = "";
    document.getElementById("email-body").value = "";
    loadEmailLog();
  } catch (error) {
    resultElement.textContent = error.message;
    resultElement.style.color = "var(--ring)";
  }
});

async function loadEmailLog() {
  const emailLog = await api.get("/api/email/log");
  const emailLogTableBody = document.getElementById("email-log-tbody");
  emailLogTableBody.innerHTML = "";
  emailLog.forEach((emailEntry) => {
    const tableRow = document.createElement("tr");
    tableRow.innerHTML = `<td>${escapeHtml(emailEntry.to)}</td><td>${escapeHtml(
      emailEntry.subject
    )}</td><td>${new Date(emailEntry.at).toLocaleString("ro-RO")}</td>`;
    emailLogTableBody.appendChild(tableRow);
  });
}

document.getElementById("add-agent-btn")?.addEventListener("click", () => {
  openAgentForm();
});

document.getElementById("agent-cancel-btn")?.addEventListener("click", () => {
  document.getElementById("agent-form-box").hidden = true;
});

document.getElementById("agent-save-btn")?.addEventListener("click", saveAgent);

function openAgentForm(existingAgent) {
  document.getElementById("agent-form-box").hidden = false;
  document.getElementById("agent-id").value = existingAgent ? existingAgent.id : "";
  document.getElementById("agent-username").value = existingAgent ? existingAgent.username : "";
  document.getElementById("agent-fullname").value = existingAgent ? existingAgent.name : "";
  document.getElementById("agent-password").value = "";
  document.getElementById("agent-role").value = existingAgent ? existingAgent.role : "agent";
}

async function saveAgent() {
  const agentId = document.getElementById("agent-id").value;
  const agentPayload = {
    username: document.getElementById("agent-username").value.trim(),
    name: document.getElementById("agent-fullname").value.trim(),
    password: document.getElementById("agent-password").value,
    role: document.getElementById("agent-role").value,
  };
  try {
    if (agentId) {
      await api.put("/api/admin/agents/" + agentId, agentPayload);
    } else {
      await api.post("/api/admin/agents", agentPayload);
    }
    document.getElementById("agent-form-box").hidden = true;
    loadAdmin();
  } catch (error) {
    alert(error.message);
  }
}

async function loadAdmin() {
  const [statsResponse, agentList, callList] = await Promise.all([
    api.get("/api/admin/stats"),
    api.get("/api/admin/agents"),
    api.get("/api/admin/calls"),
  ]);

  document.getElementById("stats-row").innerHTML = `
    ${buildStatCard(statsResponse.callsToday, "Apeluri azi")}
    ${buildStatCard(statsResponse.missedToday, "Pierdute azi")}
    ${buildStatCard(statsResponse.agentsAvailable + "/" + statsResponse.agentsOnline, "Disponibili/Online")}
    ${buildStatCard(statsResponse.smsToday, "SMS azi")}
    ${buildStatCard(statsResponse.emailsToday, "Emailuri azi")}
  `;

  const agentsTableBody = document.getElementById("agents-tbody");
  agentsTableBody.innerHTML = "";
  agentList.forEach((agent) => {
    const tableRow = document.createElement("tr");
    tableRow.innerHTML = `
      <td>${escapeHtml(agent.username)}</td><td>${escapeHtml(agent.name)}</td><td>${agent.role}</td><td>${agent.status}</td>
      <td class="row-actions">
        <button class="icon-btn" data-action="edit">Editeaza</button>
        <button class="icon-btn" data-action="delete">Sterge</button>
      </td>`;
    tableRow.querySelector('[data-action="edit"]').addEventListener("click", () => {
      openAgentForm(agent);
    });
    tableRow.querySelector('[data-action="delete"]').addEventListener("click", async () => {
      if (confirm("Sterg agentul " + agent.username + "?")) {
        try {
          await api.delete("/api/admin/agents/" + agent.id);
          loadAdmin();
        } catch (error) {
          alert(error.message);
        }
      }
    });
    agentsTableBody.appendChild(tableRow);
  });

  const callsTableBody = document.getElementById("calls-tbody");
  callsTableBody.innerHTML = "";
  callList.forEach((callLogEntry) => {
    const tableRow = document.createElement("tr");
    tableRow.innerHTML = `
      <td>${new Date(callLogEntry.startedAt).toLocaleString("ro-RO")}</td>
      <td>${escapeHtml(callLogEntry.from || "-")}</td>
      <td>${escapeHtml(callLogEntry.contactName || "-")}</td>
      <td>${escapeHtml(callLogEntry.agentUsername || "-")}</td>
      <td>${escapeHtml(callLogEntry.status || "-")}</td>
      <td>${callLogEntry.duration != null ? callLogEntry.duration + "s" : "-"}</td>`;
    callsTableBody.appendChild(tableRow);
  });
}

function buildStatCard(value, label) {
  return `<div class="stat-card"><div class="stat-value">${value}</div><div class="stat-label">${label}</div></div>`;
}

document.getElementById("settings-save-btn")?.addEventListener("click", async () => {
  const settingFieldNames = [
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
    "companyName",
    "queueName",
    "defaultBusyMinutes",
  ];
  const settingsPayload = {};
  settingFieldNames.forEach((fieldName) => {
    settingsPayload[fieldName] = document.getElementById("setting-" + fieldName).value;
  });
  const resultElement = document.getElementById("settings-result");
  try {
    await api.put("/api/settings", settingsPayload);
    resultElement.textContent = "Setari salvate.";
    resultElement.style.color = "var(--available)";
  } catch (error) {
    resultElement.textContent = error.message;
    resultElement.style.color = "var(--ring)";
  }
});

async function loadSettingsTab() {
  const settingsResponse = await api.get("/api/settings");
  const settings = settingsResponse.settings;
  const webhookUrls = settingsResponse.webhookUrls;

  Object.entries(settings).forEach(([settingKey, settingValue]) => {
    const inputElement = document.getElementById("setting-" + settingKey);
    if (inputElement) {
      inputElement.value = settingValue;
    }
  });

  const webhookListElement = document.getElementById("webhook-list");
  const webhookLabels = {
    voiceAnswerUrl: "Voice - Answer URL",
    voiceEventUrl: "Voice - Event URL",
    smsInboundUrl: "SMS - Inbound Webhook",
  };
  webhookListElement.innerHTML = "";
  Object.entries(webhookUrls).forEach(([webhookKey, webhookUrl]) => {
    const webhookRow = document.createElement("div");
    webhookRow.className = "webhook-row";
    webhookRow.innerHTML = `<div class="wh-label">${
      webhookLabels[webhookKey] || webhookKey
    }</div><div class="wh-url">${webhookUrl}</div><button>Copiaza</button>`;
    webhookRow.querySelector("button").addEventListener("click", () => {
      navigator.clipboard.writeText(webhookUrl);
      webhookRow.querySelector("button").textContent = "Copiat!";
      setTimeout(() => {
        webhookRow.querySelector("button").textContent = "Copiaza";
      }, 1500);
    });
    webhookListElement.appendChild(webhookRow);
  });
}

function escapeHtml(inputString) {
  return String(inputString).replace(
    /[&<>"']/g,
    (matchedCharacter) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[matchedCharacter])
  );
}

tryAutoLogin();
