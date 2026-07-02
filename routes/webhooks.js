const express = require("express");
const database = require("../db/db");

const router = express.Router();

const HOLD_MUSIC_URL = "https://nexmo-community.github.io/ncco-examples/assets/voice_api_audio_streaming.mp3";
const FAILED_CONNECT_STATUSES = ["busy", "rejected", "cancelled", "timeout", "failed", "unanswered", "machine"];
const FINAL_CALL_STATUSES = ["completed", "failed", "busy", "rejected", "cancelled", "timeout"];

function getParams(request) {
  return Object.assign({}, request.query, request.body);
}

function getBaseUrl(request) {
  return process.env.PUBLIC_BASE_URL || `${request.protocol}://${request.get("host")}`;
}

function findContactByPhone(data, phoneNumber) {
  if (!phoneNumber) return null;
  const cleanedPhoneNumber = String(phoneNumber).replace(/\s+/g, "");
  return (
    data.contacts.find(
      (contact) => String(contact.phone).replace(/\s+/g, "") === cleanedPhoneNumber
    ) || null
  );
}

function buildHoldActions(data, callUuid) {
  const busyAgents = data.agents.filter(
    (agent) => agent.status === "busy" && agent.busyUntil > Date.now()
  );
  let estimatedWaitMinutes = data.settings.defaultBusyMinutes;
  if (busyAgents.length > 0) {
    const soonestAvailableTimestamp = Math.min(...busyAgents.map((agent) => agent.busyUntil));
    estimatedWaitMinutes = Math.max(1, Math.ceil((soonestAvailableTimestamp - Date.now()) / 60000));
  }
  return [
    {
      action: "talk",
      language: "ro-RO",
      text: `Buna ziua. Toti operatorii sunt momentan ocupati. Timpul estimat de asteptare este de aproximativ ${estimatedWaitMinutes} minute. Va rugam asteptati, apelul dumneavoastra este important pentru noi.`,
    },
    {
      action: "conversation",
      name: data.settings.queueName + "-" + callUuid,
      startOnEnter: true,
      musicOnHoldUrl: [HOLD_MUSIC_URL],
    },
  ];
}

function addCallToLocalQueue(callUuid, callerNumber, contactName) {
  return database.update((data) => {
    const alreadyQueued = data.queue.some((entry) => entry.callUuid === callUuid);
    if (!alreadyQueued) {
      data.queue.push({
        callUuid,
        from: callerNumber,
        contactName: contactName || null,
        enqueuedAt: Date.now(),
      });
    }
  });
}

router.all("/voice/answer", (request, response) => {
  const params = getParams(request);
  const callUuid = params.uuid;
  const callerNumber = params.from;
  const baseUrl = getBaseUrl(request);
  const data = database.read();
  const matchedContact = findContactByPhone(data, callerNumber);

  database.update((freshData) => {
    freshData.callLogs.push({
      id: callUuid,
      callUuid,
      from: callerNumber,
      to: params.to,
      direction: "inbound",
      status: "ringing",
      agentUsername: null,
      contactName: matchedContact ? matchedContact.name : null,
      startedAt: Date.now(),
      endedAt: null,
      duration: null,
    });
  });

  request.app.get("io").emit("call:incoming", {
    callUuid,
    from: callerNumber,
    contactName: matchedContact ? matchedContact.name : null,
    at: Date.now(),
  });

  const availableAgents = data.agents.filter((agent) => agent.status === "available");
  const holdActions = buildHoldActions(data, callUuid);

  if (availableAgents.length > 0) {
    const chosenAgent = availableAgents[0];
    response.json([
      {
        action: "connect",
        timeout: "20",
        eventUrl: [baseUrl + "/webhooks/voice/connect-status?callUuid=" + encodeURIComponent(callUuid)],
        endpoint: [{ type: "app", user: chosenAgent.username }],
      },
      ...holdActions,
    ]);
    return;
  }

  addCallToLocalQueue(callUuid, callerNumber, matchedContact ? matchedContact.name : null);
  response.json(holdActions);
});

router.all("/voice/connect-status", (request, response) => {
  const params = getParams(request);
  const callUuid = request.query.callUuid || params.callUuid;
  const legStatus = params.status;
  if (FAILED_CONNECT_STATUSES.includes(legStatus) && callUuid) {
    const data = database.read();
    const matchedCallLog = data.callLogs.find((callLog) => callLog.callUuid === callUuid);
    addCallToLocalQueue(
      callUuid,
      matchedCallLog ? matchedCallLog.from : params.from,
      matchedCallLog ? matchedCallLog.contactName : null
    );
  }
  response.sendStatus(200);
});

router.all("/voice/event", (request, response) => {
  const params = getParams(request);
  const callUuid = params.uuid;
  const callStatus = params.status;
  database
    .update((data) => {
      const matchedCallLog = data.callLogs.find((callLog) => callLog.callUuid === callUuid);
      if (matchedCallLog) {
        matchedCallLog.status = callStatus;
        if (FINAL_CALL_STATUSES.includes(callStatus)) {
          matchedCallLog.endedAt = Date.now();
          matchedCallLog.duration = params.duration ? Number(params.duration) : matchedCallLog.duration;
          data.queue = data.queue.filter((entry) => entry.callUuid !== callUuid);
        }
      }
    })
    .then(() => {
      request.app.get("io").emit("call:update", { callUuid, status: callStatus });
    });
  response.sendStatus(200);
});

router.all("/sms/inbound", (request, response) => {
  const params = getParams(request);
  const senderNumber = params.msisdn;
  const messageBody = params.text;
  database
    .update((data) => {
      if (!data.smsThreads[senderNumber]) data.smsThreads[senderNumber] = [];
      data.smsThreads[senderNumber].push({
        direction: "inbound",
        body: messageBody,
        at: Date.now(),
      });
    })
    .then(() => {
      request.app.get("io").emit("sms:new", { phone: senderNumber, body: messageBody, at: Date.now() });
    });
  response.sendStatus(200);
});

module.exports = router;
