(function createProductionSync() {
  const config = window.SUPABASE_CONFIG ?? {};
  const deviceId = getDeviceId();
  const sessionKey = "muebleria-supabase-session-v1";
  let accessToken = "";
  let version = null;
  let initialized = false;
  let pendingState = null;
  let lastRemotePayload = null;
  let saveTimer = null;
  let pollTimer = null;
  let remoteHandler = () => {};
  let statusHandler = () => {};

  function configured() {
    return /^https:\/\/.+\.supabase\.co$/i.test(config.url ?? "")
      && String(config.publishableKey ?? "").length > 20;
  }

  function report(mode, message) {
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
      const row = await fetchCurrentRow();
      if (row) {
        version = Number(row.version);
        pendingState = null;
        lastRemotePayload = structuredClone(row.payload);
        remoteHandler(row.payload);
      } else {
        const inserted = await insertInitialState(pendingState);
        const current = inserted ?? await fetchCurrentRow();
        if (!current) throw new Error("No se pudo crear el estado compartido");
        version = Number(current.version);
        lastRemotePayload = structuredClone(current.payload);
        pendingState = null;
        remoteHandler(current.payload);
      }

      initialized = true;
      report("online", "Sincronizado");
      startPolling();
      if (pendingState) scheduleSave(pendingState);
    } catch (error) {
      console.error("No se pudo iniciar la sincronizacion:", error);
      initialized = false;
      report("error", `Sin conexion: ${friendlyError(error)}`);
    }
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
    const response = await fetch(`${config.url}/rest/v1/production_state?id=eq.main&select=payload,version,updated_by_device`, {
      headers: authHeaders()
    });
    if (!response.ok) throw new Error(`Lectura ${response.status}`);
    const rows = await response.json();
    return rows[0] ?? null;
  }

  async function insertInitialState(payload) {
    const response = await fetch(`${config.url}/rest/v1/production_state`, {
      method: "POST",
      headers: authHeaders({ Prefer: "return=representation" }),
      body: JSON.stringify({
        id: "main",
        payload,
        version: 1,
        updated_by_device: deviceId
      })
    });
    if (response.status === 409) return null;
    if (!response.ok) throw new Error(`Creacion ${response.status}`);
    const rows = await response.json();
    return rows[0] ?? null;
  }

  function startPolling() {
    clearInterval(pollTimer);
    pollTimer = setInterval(checkRemoteChanges, 2000);
  }

  async function checkRemoteChanges() {
    if (!initialized || pendingState || document.hidden) return;
    try {
      const row = await fetchCurrentRow();
      if (!row || Number(row.version) === version) return;
      version = Number(row.version);
      if (row.updated_by_device !== deviceId) {
        lastRemotePayload = structuredClone(row.payload);
        remoteHandler(row.payload);
        report("online", "Actualizado desde otro celular");
      }
    } catch {
      report("warning", "Reconectando...");
    }
  }

  function save(nextState) {
    pendingState = structuredClone(nextState);
    if (!initialized || !accessToken) return;
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
      const response = await fetch(`${config.url}/rest/v1/rpc/save_production_state`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          expected_version: expectedVersion,
          new_payload: nextState,
          device_name: deviceId
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

  window.addEventListener("offline", () => report("warning", "Sin internet: trabajando local"));
  window.addEventListener("online", () => {
    report("connecting", "Reconectando...");
    if (pendingState && initialized) scheduleSave(pendingState);
    checkRemoteChanges();
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) checkRemoteChanges();
  });

  window.productionSync = { initialize, save, configured };
})();
