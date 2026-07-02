(function createProductionSync() {
  const config = window.SUPABASE_CONFIG ?? {};
  const deviceId = getDeviceId();
  const sessionKey = "muebleria-supabase-session-v1";
  const profileCodeKey = "muebleria-profile-code-v1";
  let accessToken = "";
  let accessCode = "";
  let actorUserId = "";
  let developerAccess = false;
  let version = null;
  let initialized = false;
  let pendingState = null;
  let lastRemotePayload = null;
  let saveTimer = null;
  let pollTimer = null;
  let reconnectTimer = null;
  let reconnectPromise = null;
  let remoteCheckPromise = null;
  let retryDelay = 3000;
  let lastStatusMode = "local";
  let remoteHandler = () => {};
  let statusHandler = () => {};

  function configured() {
    return /^https:\/\/.+\.supabase\.co$/i.test(config.url ?? "")
      && String(config.publishableKey ?? "").length > 20;
  }

  function report(mode, message) {
    lastStatusMode = mode;
    statusHandler({ mode, message });
  }

  async function initialize({ initialState, onRemoteState, onStatus }) {
    remoteHandler = onRemoteState;
    statusHandler = onStatus;
    pendingState = structuredClone(initialState);

    if (!configured()) {
      report("local", "Modo local: falta configurar Supabase");
      return;
    }

    report("connecting", "Conectando...");
    try {
      await ensureSession();
      initialized = true;
      pendingState = null;
      report("ready", "Conectado");
    } catch (error) {
      console.error("No se pudo iniciar la sincronizacion:", error);
      initialized = false;
      report("error", `Sin conexion: ${friendlyError(error)}`);
      scheduleReconnect();
    }
  }

  function clearReconnectTimer() {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  function scheduleReconnect() {
    if (!configured() || reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      reconnect();
    }, retryDelay);
    retryDelay = Math.min(retryDelay * 2, 30000);
  }

  async function reconnect({ force = false } = {}) {
    if (!configured()) {
      report("local", "Modo local: falta configurar Supabase");
      return false;
    }
    if (reconnectPromise) return reconnectPromise;

    reconnectPromise = (async () => {
      clearReconnectTimer();
      report("connecting", force ? "Comprobando conexion..." : "Reconectando...");
      try {
        await ensureSession();
        initialized = true;
        retryDelay = 3000;

        if (accessCode) {
          const row = await fetchCurrentRow();
          if (!row) throw new Error("Acceso no disponible");
          const remoteVersion = Number(row.version);
          if (remoteVersion !== version || lastStatusMode !== "online") {
            version = remoteVersion;
            lastRemotePayload = structuredClone(row.payload);
            remoteHandler(row.payload);
          }
          startPolling();
          report("online", "Sincronizado");
        } else {
          report("ready", "Conectado");
        }
        return true;
      } catch (error) {
        initialized = false;
        console.error("No se pudo reconectar:", error);
        report("warning", "Sin conexion. Reintento automatico");
        scheduleReconnect();
        return false;
      } finally {
        reconnectPromise = null;
      }
    })();

    return reconnectPromise;
  }

  async function unlock(code) {
    if (!initialized) throw new Error("Todavia no hay conexion");
    accessCode = String(code ?? "").trim();
    developerAccess = false;
    report("connecting", "Validando codigo...");
    const row = await fetchCurrentRow();
    if (!row) {
      accessCode = "";
      throw new Error("Codigo incorrecto");
    }
    version = Number(row.version);
    lastRemotePayload = structuredClone(row.payload);
    remoteHandler(row.payload);
    report("online", "Sincronizado");
    startPolling();
    return row.payload;
  }

  async function developerPasswordConfigured() {
    const response = await fetch(`${config.url}/rest/v1/rpc/developer_password_configured`, {
      method: "POST",
      headers: authHeaders(),
      body: "{}"
    });
    if (!response.ok) throw new Error(`Configuracion ${response.status}`);
    return Boolean(await response.json());
  }

  async function configureDeveloperPassword(primaryCode, newPassword) {
    const response = await fetch(`${config.url}/rest/v1/rpc/configure_developer_password`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        primary_admin_code: String(primaryCode ?? "").trim(),
        new_password: String(newPassword ?? "")
      })
    });
    if (!response.ok) throw new Error(`Configuracion ${response.status}`);
    return Boolean(await response.json());
  }

  async function unlockDeveloper(password) {
    if (!initialized) throw new Error("Todavia no hay conexion");
    accessCode = String(password ?? "");
    developerAccess = true;
    report("connecting", "Validando acceso...");
    const row = await fetchCurrentRow();
    if (!row) {
      accessCode = "";
      developerAccess = false;
      throw new Error("Contrasena incorrecta");
    }
    version = Number(row.version);
    lastRemotePayload = structuredClone(row.payload);
    remoteHandler(row.payload);
    report("online", "Sincronizado");
    startPolling();
    return row.payload;
  }

  function setActor(userId, code) {
    actorUserId = String(userId ?? "");
    if (code) {
      accessCode = String(code);
      developerAccess = false;
      localStorage.setItem(profileCodeKey, accessCode);
    }
  }

  function lock() {
    actorUserId = "";
    accessCode = "";
    developerAccess = false;
    version = null;
    clearInterval(pollTimer);
    clearReconnectTimer();
    localStorage.removeItem(profileCodeKey);
    report(initialized ? "ready" : "error", initialized ? "Conectado" : "Sin conexion");
  }

  async function ensureSession() {
    const stored = readStoredSession();
    if (stored?.access_token) {
      accessToken = stored.access_token;
      if (await sessionWorks()) return;
    }
    if (stored?.refresh_token && await refreshSession(stored.refresh_token)) return;
    await createAnonymousSession();
  }

  function readStoredSession() {
    try {
      return JSON.parse(localStorage.getItem(sessionKey) || "null");
    } catch {
      return null;
    }
  }

  async function sessionWorks() {
    const response = await fetch(`${config.url}/auth/v1/user`, {
      headers: authHeaders()
    });
    return response.ok;
  }

  async function refreshSession(refreshToken) {
    const response = await fetch(`${config.url}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: baseHeaders(),
      body: JSON.stringify({ refresh_token: refreshToken })
    });
    if (!response.ok) return false;
    storeSession(await response.json());
    return true;
  }

  async function createAnonymousSession() {
    const response = await fetch(`${config.url}/auth/v1/signup`, {
      method: "POST",
      headers: baseHeaders(),
      body: "{}"
    });
    if (!response.ok) throw new Error(`Autenticacion ${response.status}`);
    storeSession(await response.json());
  }

  function storeSession(session) {
    accessToken = session.access_token;
    localStorage.setItem(sessionKey, JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token
    }));
  }

  function baseHeaders() {
    return {
      apikey: config.publishableKey,
      "Content-Type": "application/json"
    };
  }

  function authHeaders(extra = {}) {
    return {
      ...baseHeaders(),
      Authorization: `Bearer ${accessToken}`,
      ...extra
    };
  }

  async function fetchCurrentRow() {
    if (!accessCode) return null;
    const endpoint = developerAccess
      ? "read_production_state_developer"
      : "read_production_state";
    const body = developerAccess
      ? { developer_password: accessCode }
      : { access_code: accessCode };
    const response = await fetch(`${config.url}/rest/v1/rpc/${endpoint}`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(body)
    });
    if (!response.ok) throw new Error(`Lectura ${response.status}`);
    const rows = await response.json();
    return rows[0] ?? null;
  }

  function startPolling() {
    clearInterval(pollTimer);
    pollTimer = setInterval(() => checkRemoteChanges(), 5000);
  }

  async function checkRemoteChanges({ force = false } = {}) {
    if (!initialized || pendingState) return false;
    if (remoteCheckPromise) return remoteCheckPromise;

    remoteCheckPromise = (async () => {
      try {
        const row = await fetchCurrentRow();
        if (!row) throw new Error("Lectura sin datos");
        const remoteVersion = Number(row.version);
        const changed = remoteVersion !== version;

        if (changed || force) {
          version = remoteVersion;
          lastRemotePayload = structuredClone(row.payload);
          remoteHandler(row.payload);
          report("online", changed ? "Actualizado automaticamente" : "Sincronizado");
        } else if (lastStatusMode !== "online") {
          report("online", "Sincronizado");
        }
        return true;
      } catch {
        report("warning", "Reconectando...");
        scheduleReconnect();
        return false;
      } finally {
        remoteCheckPromise = null;
      }
    })();

    return remoteCheckPromise;
  }

  function save(nextState) {
    pendingState = structuredClone(nextState);
    if (!initialized || !accessToken || !accessCode || !actorUserId) return;
    scheduleSave(pendingState);
  }

  function scheduleSave(nextState) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => pushState(nextState), 180);
  }

  async function pushState(nextState) {
    if (!accessToken || version === null) return;
    const expectedVersion = version;
    report("connecting", "Guardando...");

    try {
      const credentialUsed = accessCode;
      const response = await fetch(`${config.url}/rest/v1/rpc/save_production_state_secure`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          expected_version: expectedVersion,
          new_payload: nextState,
          device_name: deviceId,
          actor_user_id: actorUserId,
          access_code: credentialUsed
        })
      });
      if (!response.ok) throw new Error(`Guardado ${response.status}`);
      const rows = await response.json();
      const saved = rows[0] ?? null;
      if (!saved) {
        const current = await fetchCurrentRow();
        version = Number(current.version);
        pendingState = null;
        lastRemotePayload = structuredClone(current.payload);
        remoteHandler(current.payload);
        report("warning", "Otro celular cambio datos; revisa y repite");
        return;
      }
      version = Number(saved.version);
      pendingState = null;
      lastRemotePayload = structuredClone(nextState);
      const actor = nextState.users?.find((user) => user.id === actorUserId);
      if (!developerAccess && actor?.code) {
        accessCode = String(actor.code);
        localStorage.setItem(profileCodeKey, accessCode);
      }
      remoteHandler(nextState);
      report("online", "Sincronizado");
    } catch (error) {
      console.error("No se pudo guardar en Supabase:", error);
      pendingState = null;
      if (lastRemotePayload) remoteHandler(structuredClone(lastRemotePayload));
      report("error", "Cambio descartado: sin conexion");
    }
  }

  function getDeviceId() {
    const key = "muebleria-device-id-v1";
    let value = localStorage.getItem(key);
    if (!value) {
      value = createCompatibleId();
      localStorage.setItem(key, value);
    }
    return value;
  }

  function createCompatibleId() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return `device-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  }

  function friendlyError(error) {
    const text = String(error?.message || "datos locales");
    return text.length > 42 ? "datos locales" : text;
  }

  window.addEventListener("offline", () => {
    report("warning", "Sin internet: solo lectura");
    scheduleReconnect();
  });
  window.addEventListener("online", () => {
    reconnect();
  });
  window.addEventListener("focus", () => {
    checkRemoteChanges({ force: true });
  });
  window.addEventListener("pageshow", () => {
    checkRemoteChanges({ force: true });
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) return;
    if (lastStatusMode === "online") {
      checkRemoteChanges({ force: true });
    } else {
      reconnect();
    }
  });

  window.productionSync = {
    initialize,
    unlock,
    unlockDeveloper,
    developerPasswordConfigured,
    configureDeveloperPassword,
    setActor,
    lock,
    save,
    reconnect,
    configured
  };
})();
