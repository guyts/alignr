import { useState, useEffect, useCallback, useRef } from "react";
import * as sync from "./sync.js";
import { openPhotoDB } from "./photoDB.js";
import PhotoCapture from "./PhotoCapture.jsx";
import PhotoTimeline from "./PhotoTimeline.jsx";

const STORAGE_KEY = "invisalign-tracker-v1";
const MS_PER_HOUR = 3600000;
const MS_PER_MIN = 60000;
const MS_PER_SEC = 1000;
const TRAY_DAYS = 7;
const MAX_OUT_MS = 2 * MS_PER_HOUR;

// --- helpers ---
function dayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function msBetween(a, b) {
  return Math.abs(new Date(b) - new Date(a));
}
function fmtTimer(ms) {
  const h = Math.floor(ms / MS_PER_HOUR);
  const m = Math.floor((ms % MS_PER_HOUR) / MS_PER_MIN);
  const s = Math.floor((ms % MS_PER_MIN) / MS_PER_SEC);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
function fmtShort(ms) {
  const h = Math.floor(ms / MS_PER_HOUR);
  const m = Math.floor((ms % MS_PER_HOUR) / MS_PER_MIN);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
function daysBetween(a, b) {
  return Math.floor(msBetween(a, b) / 86400000);
}
function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

// --- icons ---
const Icons = {
  timer: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><path d="M5 3L2 6"/><path d="M22 6l-3-3"/><path d="M12 5V2"/>
    </svg>
  ),
  swap: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/>
    </svg>
  ),
  settings: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
    </svg>
  ),
  check: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  alert: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  cloud: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z"/>
    </svg>
  ),
  cloudOk: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z"/><polyline points="8 15 10.5 17.5 16 12"/>
    </svg>
  ),
  download: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  ),
  upload: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  ),
  smileLog: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>
  ),
};

// --- localStorage persistence ---
function loadLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function saveLocal(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) { console.error("localStorage save failed", e); }
}

const DEFAULT_STATE = {
  currentTray: 1,
  trayStartDate: dayKey(),
  dailyTotals: {},
  dailyRemovals: {},
  timerRunning: false,
  timerStartedAt: null,
  swapFlow: null,
  totalTrays: null,
  photoPromptPending: false,
};

export default function App() {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [tab, setTab] = useState("timer");
  const [editTray, setEditTray] = useState(false);
  const [trayInput, setTrayInput] = useState("");
  const [totalInput, setTotalInput] = useState("");
  const [dateInput, setDateInput] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [editDay, setEditDay] = useState(null); // date key being edited
  const [editDayMins, setEditDayMins] = useState("");
  const [syncEmail, setSyncEmail] = useState(sync.getSyncEmail());
  const [emailInput, setEmailInput] = useState("");
  const [syncStatus, setSyncStatus] = useState("idle"); // idle | syncing | synced | error
  const [syncMsg, setSyncMsg] = useState("");
  const tickRef = useRef(null);
  const fileInputRef = useRef(null);
  const photoDB = useRef(null);

  // load state: localStorage first, then check cloud for newer data
  useEffect(() => {
    async function init() {
      const local = loadLocal() || { ...DEFAULT_STATE };
      setState(local);
      setLoading(false);

      if (sync.getSyncEmail() && sync.isConfigured()) {
        try {
          const remote = await sync.downloadData();
          if (remote?.state) {
            const localDays = Object.keys(local.dailyTotals).length;
            const remoteDays = Object.keys(remote.state.dailyTotals || {}).length;
            if (remoteDays > localDays || remote.state.currentTray > local.currentTray) {
              setState(remote.state);
              saveLocal(remote.state);
              setSyncMsg("Restored from cloud");
              setTimeout(() => setSyncMsg(""), 3000);
            }
          }
        } catch (e) {
          console.warn("Cloud sync check failed:", e);
        }
      }
    }
    init();
  }, []);

  // open photo DB
  useEffect(() => { openPhotoDB().then(db => { photoDB.current = db; }); }, []);

  // tick
  useEffect(() => {
    tickRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tickRef.current);
  }, []);

  // save on every change
  useEffect(() => {
    if (state && !loading) {
      saveLocal(state);
      sync.scheduleSync(state);
    }
  }, [state, loading]);

  const update = useCallback((fn) => setState(prev => {
    const next = { ...prev };
    fn(next);
    return next;
  }), []);

  // --- Cloud sync handlers ---
  async function connectEmail() {
    const email = emailInput.trim();
    if (!email || !email.includes("@")) return;
    setSyncStatus("syncing");
    setSyncMsg("Connecting...");
    await sync.uploadData.bind(null); // ensure module loaded
    // save email first so download can use it
    localStorage.setItem("alignr-sync-email", email);
    setSyncEmail(email);
    setEmailInput("");
    // check if cloud has data
    const remote = await sync.downloadData();
    if (remote?.state) {
      const localDays = Object.keys((state?.dailyTotals) || {}).length;
      const remoteDays = Object.keys(remote.state.dailyTotals || {}).length;
      if (remoteDays > localDays || remote.state.currentTray > (state?.currentTray || 0)) {
        setState(remote.state);
        saveLocal(remote.state);
        setSyncMsg("Loaded your cloud data!");
      } else {
        await sync.uploadData(state);
        setSyncMsg("Connected & synced!");
      }
    } else {
      await sync.uploadData(state);
      setSyncMsg("Connected & synced!");
    }
    setSyncStatus("synced");
    setTimeout(() => setSyncMsg(""), 3000);
  }
  function disconnectSync() {
    sync.clearSyncEmail();
    setSyncEmail("");
    setSyncStatus("idle");
  }
  async function forceSyncNow() {
    if (!state) return;
    setSyncStatus("syncing");
    setSyncMsg("Syncing...");
    const ok = await sync.uploadData(state);
    setSyncStatus(ok ? "synced" : "error");
    setSyncMsg(ok ? "Synced!" : "Sync failed");
    setTimeout(() => setSyncMsg(""), 3000);
  }

  // --- Manual export/import ---
  function exportData() {
    if (!state) return;
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `alignr-backup-${dayKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  function importData(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(reader.result);
        if (imported.currentTray && imported.trayStartDate) {
          setState(imported);
          setSyncMsg("Data restored!");
          setTimeout(() => setSyncMsg(""), 3000);
        } else {
          setSyncMsg("Invalid backup file");
          setTimeout(() => setSyncMsg(""), 3000);
        }
      } catch {
        setSyncMsg("Failed to parse file");
        setTimeout(() => setSyncMsg(""), 3000);
      }
    };
    reader.readAsText(file);
  }

  if (loading || !state) {
    return (
      <div style={styles.loadWrap}>
        <div style={styles.loadPulse} />
      </div>
    );
  }

  // --- derived ---
  const today = dayKey();
  const todayAccumulated = state.dailyTotals[today] || 0;
  const liveExtra = state.timerRunning && state.timerStartedAt
    ? now - new Date(state.timerStartedAt).getTime() : 0;
  const todayTotal = todayAccumulated + liveExtra;
  const todayPct = Math.min(todayTotal / MAX_OUT_MS, 1);
  const remaining = Math.max(MAX_OUT_MS - todayTotal, 0);

  const trayStart = new Date(state.trayStartDate);
  const daysOnTray = daysBetween(trayStart, new Date());
  const swapDue = daysOnTray >= TRAY_DAYS;
  const nextSwapDate = addDays(trayStart, TRAY_DAYS);
  const daysUntilSwap = Math.max(0, daysBetween(new Date(), nextSwapDate));

  // --- handlers ---
  function toggleTimer() {
    update(s => {
      if (s.timerRunning) {
        const elapsed = Date.now() - new Date(s.timerStartedAt).getTime();
        s.dailyTotals[today] = (s.dailyTotals[today] || 0) + elapsed;
        s.timerRunning = false;
        s.timerStartedAt = null;
      } else {
        s.timerRunning = true;
        s.timerStartedAt = new Date().toISOString();
        s.dailyRemovals = s.dailyRemovals || {};
        s.dailyRemovals[today] = (s.dailyRemovals[today] || 0) + 1;
      }
    });
  }

  function startSwapFlow() {
    // prompt for photo first (tray is out, teeth visible) before trying the new tray
    update(s => { s.photoPromptPending = true; s.swapFlow = { stage: "try", stageDate: dayKey() }; });
  }
  function swapFits() {
    update(s => {
      s.currentTray += 1;
      s.trayStartDate = dayKey();
      s.swapFlow = null;
    });
    sync.scheduleSync(state);
  }
  function swapDoesntFit() {
    update(s => { s.swapFlow = { stage: "wait2", stageDate: dayKey() }; });
  }
  function retryAfterWait() {
    update(s => { s.swapFlow = { stage: "try", stageDate: dayKey() }; });
  }
  function stillDoesntFit() {
    update(s => {
      if (s.swapFlow.stage === "wait2" || s.swapFlow.stage === "try") {
        s.swapFlow = { stage: "wait1", stageDate: dayKey() };
      }
    });
  }
  function cancelSwapFlow() {
    update(s => { s.swapFlow = null; });
  }
  function openDayEdit(day) {
    const ms = state.dailyTotals[day] || 0;
    setEditDayMins(String(Math.round(ms / 60000)));
    setEditDay(day);
  }
  function saveDayEdit() {
    const mins = parseInt(editDayMins, 10);
    if (!isNaN(mins) && mins >= 0) {
      update(s => { s.dailyTotals[editDay] = mins * 60000; });
    }
    setEditDay(null);
  }
  function saveTrayEdit() {
    update(s => {
      const t = parseInt(trayInput);
      if (t > 0) s.currentTray = t;
      const tot = parseInt(totalInput);
      if (tot > 0) s.totalTrays = tot;
      else if (totalInput === "") s.totalTrays = null;
      if (dateInput) s.trayStartDate = dateInput;
    });
    setEditTray(false);
  }

  // week history
  const weekDays = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = dayKey(d);
    weekDays.push({
      label: d.toLocaleDateString("en", { weekday: "short" }),
      date: key,
      ms: state.dailyTotals[key] || 0,
      isToday: key === today,
    });
  }

  // swap flow
  function renderSwapFlow() {
    const flow = state.swapFlow;
    if (!flow) return null;
    const daysInStage = daysBetween(new Date(flow.stageDate), new Date());

    if (flow.stage === "try") {
      return (
        <div style={styles.swapCard}>
          <div style={styles.swapCardHeader}>
            <span style={styles.swapEmoji}>🔄</span>
            <span>Try Tray #{state.currentTray + 1}</span>
          </div>
          <p style={styles.swapText}>Put in the new tray and check for large empty spaces between the tray and your teeth.</p>
          <div style={styles.swapBtns}>
            <button style={styles.btnSuccess} onClick={swapFits}>{Icons.check} Fits well!</button>
            <button style={styles.btnWarn} onClick={swapDoesntFit}>{Icons.alert} Gaps / doesn't fit</button>
          </div>
          <button style={styles.btnGhost} onClick={cancelSwapFlow}>Cancel</button>
        </div>
      );
    }
    if (flow.stage === "wait2") {
      const ready = daysInStage >= 2;
      return (
        <div style={styles.swapCard}>
          <div style={styles.swapCardHeader}>
            <span style={styles.swapEmoji}>⏳</span>
            <span>Waiting — check back in {ready ? "0" : 2 - daysInStage} days</span>
          </div>
          <p style={styles.swapText}>Keep wearing tray #{state.currentTray}. Your teeth need more time to move.</p>
          {ready ? (
            <div style={styles.swapBtns}>
              <button style={styles.btnPrimary} onClick={retryAfterWait}>Try new tray again</button>
            </div>
          ) : (
            <p style={{ ...styles.swapText, opacity: 0.6 }}>Come back {addDays(flow.stageDate, 2).toLocaleDateString("en", { weekday: "long", month: "short", day: "numeric" })}</p>
          )}
          <button style={styles.btnGhost} onClick={cancelSwapFlow}>Cancel</button>
        </div>
      );
    }
    if (flow.stage === "wait1") {
      const ready = daysInStage >= 1;
      return (
        <div style={styles.swapCard}>
          <div style={styles.swapCardHeader}>
            <span style={styles.swapEmoji}>⏳</span>
            <span>Almost there — check back {ready ? "now" : "tomorrow"}</span>
          </div>
          <p style={styles.swapText}>Still wearing tray #{state.currentTray}. One more day should do it.</p>
          {ready ? (
            <div style={styles.swapBtns}>
              <button style={styles.btnPrimary} onClick={retryAfterWait}>Try new tray again</button>
            </div>
          ) : null}
          <button style={styles.btnGhost} onClick={cancelSwapFlow}>Cancel</button>
        </div>
      );
    }
    return null;
  }

  return (
    <div style={styles.root}>
      {/* header */}
      <div style={styles.header}>
        <div style={styles.headerTop}>
          <h1 style={styles.title}>alignr</h1>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button style={styles.trayBadge} onClick={() => { setEditTray(true); setTrayInput(String(state.currentTray)); setTotalInput(state.totalTrays ? String(state.totalTrays) : ""); setDateInput(state.trayStartDate); }}>
              Tray #{state.currentTray}{state.totalTrays ? ` / ${state.totalTrays}` : ""}
            </button>
            <button style={styles.settingsBtn} onClick={() => setShowSettings(true)}>
              {Icons.settings}
            </button>
          </div>
        </div>
        <p style={styles.subtitle}>
          Day {daysOnTray + 1} of {TRAY_DAYS}
          {daysUntilSwap > 0 ? ` · swap in ${daysUntilSwap}d` : " · swap day!"}
          {syncEmail && syncStatus !== "error" && <span style={styles.syncBadge}> · {Icons.cloudOk} synced</span>}
        </p>
      </div>

      {/* sync toast */}
      {syncMsg && <div style={styles.toast}>{syncMsg}</div>}

      {/* tray edit modal */}
      {editTray && (
        <div style={styles.modal} onClick={() => setEditTray(false)}>
          <div style={styles.modalInner} onClick={e => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>Edit Tray Info</h3>
            <label style={styles.label}>Current tray #</label>
            <input style={styles.input} type="number" min="1" value={trayInput} onChange={e => setTrayInput(e.target.value)} />
            <label style={styles.label}>Started wearing this tray on</label>
            <input style={styles.input} type="date" value={dateInput} max={dayKey()} onChange={e => setDateInput(e.target.value)} />
            <p style={styles.dateHint}>Set this if you're mid-tray or starting mid-treatment</p>
            <label style={styles.label}>Total trays (optional)</label>
            <input style={styles.input} type="number" min="1" value={totalInput} onChange={e => setTotalInput(e.target.value)} placeholder="e.g. 22" />
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button style={styles.btnPrimary} onClick={saveTrayEdit}>Save</button>
              <button style={styles.btnGhost} onClick={() => setEditTray(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* day edit modal */}
      {editDay && (
        <div style={styles.modal} onClick={() => setEditDay(null)}>
          <div style={styles.modalInner} onClick={e => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>Edit {editDay === dayKey() ? "Today" : editDay}</h3>
            <label style={styles.label}>Total time out (minutes)</label>
            <input
              style={styles.input}
              type="number"
              min="0"
              max="480"
              value={editDayMins}
              onChange={e => setEditDayMins(e.target.value)}
              autoFocus
            />
            <p style={styles.dateHint}>
              {editDay === dayKey() && state.timerRunning
                ? "Timer is currently running — this sets the accumulated total, the active session will add on top."
                : "Override the recorded out-of-tray time for this day."}
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button style={styles.btnPrimary} onClick={saveDayEdit}>Save</button>
              <button style={styles.btnGhost} onClick={() => setEditDay(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* settings modal */}
      {showSettings && (
        <div style={styles.modal} onClick={() => setShowSettings(false)}>
          <div style={styles.modalInner} onClick={e => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>Settings & Backup</h3>

            {/* Cloud Sync */}
            <div style={styles.settingsSection}>
              <h4 style={styles.settingLabel}>Cloud Sync</h4>
              {!sync.isConfigured() ? (
                <p style={styles.settingDesc}>Cloud sync is not configured for this deployment.</p>
              ) : syncEmail ? (
                <>
                  <p style={styles.settingDesc}>Syncing as <strong style={{ color: "#e8edf5" }}>{syncEmail}</strong>. Data auto-saves every 5 seconds.</p>
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button style={styles.btnSmall} onClick={forceSyncNow}>{Icons.cloud} Sync now</button>
                    <button style={{ ...styles.btnSmall, ...styles.btnSmallDanger }} onClick={disconnectSync}>Sign out</button>
                  </div>
                </>
              ) : (
                <>
                  <p style={styles.settingDesc}>Enter your email to sync across devices. Same email = same data, no password needed.</p>
                  <input
                    style={{ ...styles.input, marginTop: 10 }}
                    type="email"
                    placeholder="you@example.com"
                    value={emailInput}
                    onChange={e => setEmailInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && connectEmail()}
                  />
                  <button style={{ ...styles.btnSmall, marginTop: 8 }} onClick={connectEmail}>
                    {Icons.cloud} Connect
                  </button>
                </>
              )}
            </div>

            {/* Manual backup */}
            <div style={styles.settingsSection}>
              <h4 style={styles.settingLabel}>Manual Backup</h4>
              <p style={styles.settingDesc}>Export your data as a JSON file, or restore from a previous backup.</p>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button style={styles.btnSmall} onClick={exportData}>{Icons.download} Export</button>
                <button style={styles.btnSmall} onClick={() => fileInputRef.current?.click()}>{Icons.upload} Import</button>
                <input ref={fileInputRef} type="file" accept=".json" style={{ display: "none" }} onChange={importData} />
              </div>
            </div>

            <button style={{ ...styles.btnGhost, marginTop: 16 }} onClick={() => setShowSettings(false)}>Close</button>
          </div>
        </div>
      )}

      {/* photo capture modal — appears when tray is out before swap */}
      {state.photoPromptPending && (
        <PhotoCapture
          trayNum={state.currentTray}
          db={photoDB.current}
          onSaved={() => update(s => { s.photoPromptPending = false; })}
          onSkip={() => update(s => { s.photoPromptPending = false; })}
        />
      )}

      {/* tabs */}
      <div style={styles.tabs}>
        {[
          { id: "timer", icon: Icons.timer, label: "Timer" },
          { id: "swap", icon: Icons.swap, label: "Swap" },
          { id: "smilelog", icon: Icons.smileLog, label: "Smile Log" },
        ].map(t => (
          <button
            key={t.id}
            style={tab === t.id ? { ...styles.tab, ...styles.tabActive } : styles.tab}
            onClick={() => setTab(t.id)}
          >
            {t.icon}
            <span>{t.label}</span>
            {t.id === "swap" && swapDue && !state.swapFlow && <span style={styles.dot} />}
          </button>
        ))}
      </div>

      {/* TIMER TAB */}
      {tab === "timer" && (
        <div style={styles.content}>
          <div style={styles.timerWrap}>
            <svg viewBox="0 0 200 200" style={styles.timerSvg}>
              <circle cx="100" cy="100" r="88" fill="none" stroke="#1e2535" strokeWidth="10" />
              <circle cx="100" cy="100" r="88" fill="none"
                stroke={todayPct >= 1 ? "#f06868" : state.timerRunning ? "#5ce0d8" : "#3a8f8a"}
                strokeWidth="10" strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 88}`}
                strokeDashoffset={`${2 * Math.PI * 88 * (1 - todayPct)}`}
                transform="rotate(-90 100 100)"
                style={{ transition: "stroke-dashoffset 0.5s ease, stroke 0.3s" }}
              />
            </svg>
            <div style={styles.timerInner}>
              <span style={{ ...styles.timerDigits, color: todayPct >= 1 ? "#f06868" : state.timerRunning ? "#5ce0d8" : "#e8edf5" }}>
                {fmtTimer(todayTotal)}
              </span>
              <span style={styles.timerLabel}>
                {todayPct >= 1 ? "Over 2h limit!" : `${fmtShort(remaining)} left`}
              </span>
            </div>
          </div>

          <button
            style={state.timerRunning ? { ...styles.bigBtn, ...styles.bigBtnActive } : styles.bigBtn}
            onClick={toggleTimer}
          >
            {state.timerRunning ? "Tray back in ✓" : "Tray out"}
          </button>
          <p style={styles.hint}>
            {state.timerRunning
              ? "Timer running — tap when you put the tray back in"
              : "Tap when you take the tray out to eat, drink, or brush"}
          </p>
          {((state.dailyRemovals || {})[today] || 0) > 0 && (
            <p style={styles.removalCount}>
              Removed <strong>{(state.dailyRemovals || {})[today]}×</strong> today
            </p>
          )}

          <div style={styles.weekCard}>
            <h3 style={styles.weekTitle}>This week</h3>
            <div style={styles.weekBars}>
              {weekDays.map(d => {
                const totalMs = d.isToday ? todayTotal : d.ms;
                const pct = Math.min(totalMs / MAX_OUT_MS, 1);
                const over = totalMs > MAX_OUT_MS;
                return (
                  <div key={d.date} style={{ ...styles.barCol, cursor: "pointer" }} onClick={() => openDayEdit(d.date)}>
                    <div style={styles.barTrack}>
                      <div style={{
                        ...styles.barFill,
                        height: `${Math.max(pct * 100, 2)}%`,
                        background: over ? "#f06868" : d.isToday ? "#5ce0d8" : "#3a8f8a",
                      }} />
                    </div>
                    <span style={{ ...styles.barLabel, fontWeight: d.isToday ? 700 : 400, color: d.isToday ? "#5ce0d8" : "#6b7a94" }}>{d.label}</span>
                    <span style={styles.barVal}>{totalMs > 0 ? fmtShort(totalMs) : "–"}</span>
                    <span style={styles.barRemovals}>{((state.dailyRemovals || {})[d.date] || 0) > 0 ? `${(state.dailyRemovals || {})[d.date]}×` : ""}</span>
                  </div>
                );
              })}
            </div>
            <div style={styles.weekLegend}>
              <div style={styles.legendItem}><div style={{ ...styles.legendDot, background: "#3a8f8a" }} /> Under 2h</div>
              <div style={styles.legendItem}><div style={{ ...styles.legendDot, background: "#f06868" }} /> Over 2h</div>
            </div>
          </div>
        </div>
      )}

      {/* SMILE LOG TAB */}
      {tab === "smilelog" && (
        <PhotoTimeline
          db={photoDB.current}
          currentTray={state.currentTray}
          onRequestPhoto={() => update(s => { s.photoPromptPending = true; })}
        />
      )}

      {/* SWAP TAB */}
      {tab === "swap" && (
        <div style={styles.content}>
          <div style={styles.trayProgress}>
            <div style={styles.trayProgressHeader}>
              <span style={styles.trayProgressLabel}>Tray #{state.currentTray} progress</span>
              <span style={styles.trayProgressDays}>Day {Math.min(daysOnTray + 1, TRAY_DAYS + 5)} / {TRAY_DAYS}</span>
            </div>
            <div style={styles.progressTrack}>
              {Array.from({ length: TRAY_DAYS }).map((_, i) => (
                <div key={i} style={{
                  ...styles.progressDot,
                  background: i <= daysOnTray ? (swapDue ? "#5ce0d8" : "#3a8f8a") : "#1e2535",
                }} />
              ))}
            </div>
          </div>

          {state.swapFlow ? renderSwapFlow() : swapDue ? (
            <div style={styles.swapPrompt}>
              <p style={styles.swapPromptText}>
                You've been wearing tray #{state.currentTray} for {daysOnTray} days. Time to check if you're ready for the next one!
              </p>
              <button style={styles.btnPrimary} onClick={startSwapFlow}>Start swap check</button>
            </div>
          ) : (
            <div style={styles.swapIdle}>
              <div style={styles.swapIdleIcon}>😊</div>
              <p style={styles.swapIdleText}>
                Keep wearing tray #{state.currentTray}.
                <br />Next swap check: <strong>{nextSwapDate.toLocaleDateString("en", { weekday: "long", month: "short", day: "numeric" })}</strong>
              </p>
            </div>
          )}

          <div style={styles.historyCard}>
            <h3 style={styles.weekTitle}>Tray history</h3>
            <div style={styles.historyItem}>
              <div style={{ ...styles.historyDot, background: "#5ce0d8" }} />
              <div>
                <span style={styles.historyTray}>Tray #{state.currentTray}</span>
                <span style={styles.historyDate}>Started {new Date(state.trayStartDate).toLocaleDateString("en", { month: "short", day: "numeric" })}</span>
              </div>
            </div>
            {state.currentTray > 1 && (
              <div style={styles.historyItem}>
                <div style={styles.historyDot} />
                <div>
                  <span style={styles.historyTray}>Trays 1–{state.currentTray - 1}</span>
                  <span style={styles.historyDate}>Completed</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// --- styles ---
const styles = {
  root: {
    fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif",
    maxWidth: 420, margin: "0 auto", minHeight: "100vh",
    background: "#0c0f14", color: "#e8edf5", padding: "0 0 40px",
  },
  loadWrap: { display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", background: "#0c0f14" },
  loadPulse: { width: 40, height: 40, borderRadius: "50%", background: "#5ce0d8", animation: "pulse 1s infinite alternate" },

  header: { padding: "28px 20px 12px", background: "linear-gradient(180deg, #111723 0%, #0c0f14 100%)" },
  headerTop: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em", margin: 0, background: "linear-gradient(135deg, #5ce0d8, #5ca0e0)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" },
  trayBadge: {
    background: "rgba(92,224,216,0.12)", border: "1px solid rgba(92,224,216,0.25)", borderRadius: 20, padding: "5px 14px",
    color: "#5ce0d8", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
  },
  settingsBtn: {
    background: "none", border: "none", color: "#6b7a94", cursor: "pointer", padding: 4,
    display: "flex", alignItems: "center",
  },
  subtitle: { margin: "6px 0 0", fontSize: 14, color: "#6b7a94", fontWeight: 500 },
  syncBadge: { color: "#5ce0a0", fontSize: 12 },

  toast: {
    position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)",
    background: "#1c2230", color: "#5ce0d8", padding: "8px 20px", borderRadius: 12,
    fontSize: 13, fontWeight: 600, zIndex: 200, border: "1px solid rgba(92,224,216,0.2)",
    animation: "fadeIn 0.2s ease",
  },

  tabs: { display: "flex", padding: "0 16px", gap: 6, marginTop: 8 },
  tab: {
    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
    padding: "11px 0", borderRadius: 12, border: "none", background: "transparent",
    color: "#6b7a94", fontSize: 14, fontWeight: 600, cursor: "pointer",
    fontFamily: "inherit", position: "relative", transition: "all 0.2s",
  },
  tabActive: { background: "#161b24", color: "#5ce0d8" },
  dot: { position: "absolute", top: 8, right: "22%", width: 7, height: 7, borderRadius: "50%", background: "#f06868" },

  content: { padding: "16px 20px" },

  timerWrap: { position: "relative", width: 220, height: 220, margin: "12px auto 20px" },
  timerSvg: { width: "100%", height: "100%" },
  timerInner: { position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" },
  timerDigits: { fontSize: 36, fontWeight: 800, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" },
  timerLabel: { fontSize: 13, color: "#6b7a94", marginTop: 2, fontWeight: 500 },

  bigBtn: {
    width: "100%", padding: "16px 0", borderRadius: 16, border: "2px solid #5ce0d8",
    background: "rgba(92,224,216,0.12)", color: "#5ce0d8", fontSize: 17, fontWeight: 700,
    cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s",
  },
  bigBtnActive: { background: "#5ce0d8", color: "#0c0f14", border: "2px solid #5ce0d8" },
  hint: { textAlign: "center", fontSize: 13, color: "#6b7a94", margin: "10px 0 24px", lineHeight: 1.5 },

  weekCard: { background: "#161b24", borderRadius: 16, padding: "18px 16px 14px" },
  weekTitle: { margin: "0 0 14px", fontSize: 15, fontWeight: 700 },
  weekBars: { display: "flex", gap: 6, justifyContent: "space-between" },
  barCol: { display: "flex", flexDirection: "column", alignItems: "center", flex: 1, gap: 4 },
  barTrack: { width: "100%", height: 60, background: "#1e2535", borderRadius: 6, position: "relative", overflow: "hidden", display: "flex", alignItems: "flex-end" },
  barFill: { width: "100%", borderRadius: 6, transition: "height 0.4s ease", minHeight: 2 },
  barLabel: { fontSize: 11 },
  barVal: { fontSize: 10, color: "#6b7a94", fontVariantNumeric: "tabular-nums" },
  weekLegend: { display: "flex", gap: 16, marginTop: 12, justifyContent: "center" },
  legendItem: { display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#6b7a94" },
  legendDot: { width: 8, height: 8, borderRadius: "50%" },

  trayProgress: { background: "#161b24", borderRadius: 16, padding: "16px 18px", marginBottom: 16 },
  trayProgressHeader: { display: "flex", justifyContent: "space-between", marginBottom: 12 },
  trayProgressLabel: { fontSize: 14, fontWeight: 600 },
  trayProgressDays: { fontSize: 13, color: "#6b7a94", fontWeight: 500 },
  progressTrack: { display: "flex", gap: 6 },
  progressDot: { flex: 1, height: 8, borderRadius: 4, transition: "background 0.3s" },

  swapCard: { background: "#161b24", borderRadius: 16, padding: "20px 18px", border: "1px solid rgba(92,224,216,0.15)", marginBottom: 16 },
  swapCardHeader: { display: "flex", alignItems: "center", gap: 10, fontSize: 16, fontWeight: 700, marginBottom: 10 },
  swapEmoji: { fontSize: 22 },
  swapText: { fontSize: 14, color: "#6b7a94", lineHeight: 1.6, margin: "0 0 16px" },
  swapBtns: { display: "flex", gap: 8, marginBottom: 8 },
  swapPrompt: { background: "#161b24", borderRadius: 16, padding: "20px 18px", textAlign: "center", marginBottom: 16 },
  swapPromptText: { fontSize: 14, color: "#6b7a94", lineHeight: 1.6, margin: "0 0 16px" },
  swapIdle: { background: "#161b24", borderRadius: 16, padding: "28px 18px", textAlign: "center", marginBottom: 16 },
  swapIdleIcon: { fontSize: 36, marginBottom: 8 },
  swapIdleText: { fontSize: 14, color: "#6b7a94", lineHeight: 1.7, margin: 0 },

  historyCard: { background: "#161b24", borderRadius: 16, padding: "18px 16px" },
  historyItem: { display: "flex", alignItems: "center", gap: 12, padding: "8px 0" },
  historyDot: { width: 10, height: 10, borderRadius: "50%", background: "#6b7a94", flexShrink: 0 },
  historyTray: { display: "block", fontSize: 14, fontWeight: 600 },
  historyDate: { display: "block", fontSize: 12, color: "#6b7a94", marginTop: 1 },

  btnPrimary: {
    padding: "11px 22px", borderRadius: 12, border: "none", background: "#5ce0d8",
    color: "#0c0f14", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
    display: "flex", alignItems: "center", gap: 6,
  },
  btnSuccess: {
    padding: "11px 18px", borderRadius: 12, border: "none", background: "#5ce0a0",
    color: "#0c0f14", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
    display: "flex", alignItems: "center", gap: 6, flex: 1, justifyContent: "center",
  },
  btnWarn: {
    padding: "11px 18px", borderRadius: 12, border: "none", background: "#f06868",
    color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
    display: "flex", alignItems: "center", gap: 6, flex: 1, justifyContent: "center",
  },
  btnGhost: {
    padding: "8px 16px", borderRadius: 10, border: "1px solid #1e2535", background: "transparent",
    color: "#6b7a94", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", marginTop: 4,
  },
  btnSmall: {
    padding: "7px 14px", borderRadius: 8, border: "1px solid rgba(92,224,216,0.25)", background: "rgba(92,224,216,0.08)",
    color: "#5ce0d8", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
    display: "flex", alignItems: "center", gap: 5,
  },
  btnSmallDanger: { borderColor: "rgba(240,104,104,0.25)", background: "rgba(240,104,104,0.08)", color: "#f06868" },

  modal: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex",
    alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20,
  },
  modalInner: { background: "#1c2230", borderRadius: 20, padding: "24px 22px", width: "100%", maxWidth: 360 },
  modalTitle: { margin: "0 0 16px", fontSize: 18, fontWeight: 700 },
  label: { display: "block", fontSize: 13, color: "#6b7a94", fontWeight: 500, margin: "12px 0 5px" },
  input: {
    width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid #1e2535",
    background: "#0c0f14", color: "#e8edf5", fontSize: 15, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
  },
  dateHint: { fontSize: 12, color: "#6b7a94", margin: "4px 0 0", lineHeight: 1.4 },

  settingsSection: { background: "#161b24", borderRadius: 12, padding: "14px 16px", marginBottom: 12 },
  settingLabel: { fontSize: 14, fontWeight: 700, margin: "0 0 4px" },
  settingDesc: { fontSize: 13, color: "#6b7a94", lineHeight: 1.5, margin: 0 },
  code: { background: "#0c0f14", padding: "1px 6px", borderRadius: 4, fontSize: 12 },

  removalCount: { textAlign: "center", fontSize: 13, color: "#6b7a94", margin: "-4px 0 0" },
  barRemovals: { fontSize: 10, color: "#6b7a94", textAlign: "center", minHeight: 14, lineHeight: "14px" },
};
