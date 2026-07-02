const VoiceModule = (() => {
  let client = null;
  let activeCallId = null;
  let callTimerInterval = null;

  async function init(onEvent) {
    let accessToken;
    try {
      const tokenResponse = await api.get("/api/voice/token");
      accessToken = tokenResponse.token;
    } catch (error) {
      onEvent("error", "Nu s-a putut obtine tokenul Vonage: " + error.message);
      return;
    }

    client = new vonageClientSDK.VonageClient({ region: vonageClientSDK.ConfigRegion.EU });

    client.on("callInvite", (callId, from, channelType) => {
      activeCallId = callId;
      onEvent("incoming", { from: from || "Necunoscut" });
    });

    client.on("callInviteCancel", () => {
      activeCallId = null;
      onEvent("disconnected");
    });

    client.on("callHangup", () => {
      activeCallId = null;
      stopTimer();
      onEvent("disconnected");
    });

    try {
      await client.createSession(accessToken);
      onEvent("ready");
    } catch (error) {
      onEvent("error", "Conectarea la Vonage a esuat: " + error.message);
    }
  }

  function startTimer(onEvent) {
    const startTimestamp = Date.now();
    callTimerInterval = setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - startTimestamp) / 1000);
      const minutesLabel = String(Math.floor(elapsedSeconds / 60)).padStart(2, "0");
      const secondsLabel = String(elapsedSeconds % 60).padStart(2, "0");
      onEvent("timer", `${minutesLabel}:${secondsLabel}`);
    }, 1000);
  }

  function stopTimer() {
    if (callTimerInterval) {
      clearInterval(callTimerInterval);
    }
    callTimerInterval = null;
  }

  async function answer(onEvent) {
    if (!activeCallId || !client) return;
    try {
      await client.answer(activeCallId);
      onEvent("connected", { from: "Apel conectat" });
      startTimer(onEvent);
    } catch (error) {
      onEvent("error", "Nu s-a putut raspunde la apel: " + error.message);
    }
  }

  function reject() {
    if (activeCallId && client) {
      client.reject(activeCallId);
      activeCallId = null;
    }
  }

  function hangup() {
    if (activeCallId && client) {
      client.hangup(activeCallId);
      activeCallId = null;
    }
  }

  return { init, answer, reject, hangup };
})();
