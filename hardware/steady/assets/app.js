// Clarah Steady dashboard. Served by the UNO Q (python/main.py) on port 7000.

const $ = (id) => document.getElementById(id);
const socket = io(`http://${window.location.host}`);

let settings = {};
let status = null;
let balance = null;
let events = [];
let liveMags = [];
const relayed = new Set();
let lastWarningAt = 0;

const EVENT_INFO = {
  fall_suspected: ["Hard movement, checking for a fall", "warn"],
  fall_detected: ["Fall detected", "alert"],
  fall_dismissed: ["Not a fall: still upright", "ok"],
  fall_cancelled: ["Fall alarm cancelled: “I'm OK”", "ok"],
  help_pressed: ["Help button pressed", "warn"],
  help_cancelled: ["Help request cancelled", "ok"],
  emergency: ["Emergency alert sent", "alert"],
  resolved: ["Alert resolved", "ok"],
  silenced: ["Alarm silenced", ""],
  balance_warning: ["Balance warning", "warn"],
  doctor_alerted: ["Doctor notified", "warn"],
  baseline_set: ["Baseline updated", ""],
  settings_saved: ["Settings saved", ""],
  sample_data: ["Sample data loaded", ""],
  history_cleared: ["Walking history cleared", ""],
  sensor_missing: ["Accelerometer not responding", "alert"],
  sensor_ok: ["Accelerometer connected", "ok"],
};

const fmtTime = (t) => new Date(t * 1000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const fmtDay = (t) => new Date(t * 1000).toLocaleDateString([], { month: "short", day: "numeric" });
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// ------------------------------------------------------------------ socket

const hello = () => ({ now: Date.now(), tz_offset_min: -new Date().getTimezoneOffset() });
socket.on("connect", () => socket.emit("hello", hello()));
socket.on("disconnect", () => renderPill());
socket.on("settings", (s) => { settings = s; fillSettings(); });
socket.on("status", (s) => { status = s; renderPill(); renderOverlay(); });
socket.on("balance", (b) => { balance = b; renderBalance(); });
socket.on("events", (m) => { events = m.items; renderEvents(); });
socket.on("event", (ev) => { events.push(ev); renderEvents(); if (ev.kind === "balance_warning") showWarning(ev); });
socket.on("trace", () => socket.emit("hello", hello()));
socket.on("imu", (m) => { liveMags.push(...m.m); if (liveMags.length > 500) liveMags = liveMags.slice(-500); });
socket.on("outbox", relayOutbox);

// ------------------------------------------------------------------ header

function renderPill() {
  const pill = $("device-pill");
  if (!socket.connected) { pill.textContent = "Dashboard offline"; pill.className = "pill bad"; return; }
  const d = status?.device;
  if (!d || !d.online) { pill.textContent = "Device not responding"; pill.className = "pill bad"; return; }
  if (d.sensor === "missing") { pill.textContent = "Check accelerometer"; pill.className = "pill bad"; return; }
  const label = { normal: "Monitoring", fall_check: "Checking", fall_countdown: "Fall alarm", help_countdown: "Help requested", emergency: "Emergency" }[d.state] || d.state;
  pill.textContent = label;
  pill.className = "pill " + (d.state === "normal" ? "ok" : "bad");
}

function renderBalance() {
  const b = balance;
  if (!b) return;
  const score = b.smoothed ?? b.score;
  $("score").textContent = score == null ? "—" : Math.round(score);
  const risk = $("risk");
  risk.className = "risk risk-" + (b.risk || "unknown");
  risk.textContent = { low: "Low", moderate: "Moderate", high: "High" }[b.risk] || "Not enough walking yet";

  let text;
  if (score == null) text = "Walk for about 30 seconds with the device clipped at your waist to get a score.";
  else {
    const parts = [];
    if (b.slope != null) {
      const per10 = b.slope * 10;
      if (Math.abs(per10) < 2) parts.push("Holding steady over your recent walking.");
      else if (per10 < 0) parts.push(`Slipping about ${Math.abs(per10).toFixed(0)} points per 10 minutes of walking.`);
      else parts.push(`Improving about ${per10.toFixed(0)} points per 10 minutes of walking.`);
    }
    if (b.baseline != null) {
      const diff = score - b.baseline;
      parts.push(Math.abs(diff) < 3 ? "In line with your baseline." : `${Math.abs(diff).toFixed(0)} ${diff < 0 ? "below" : "above"} your baseline of ${Math.round(b.baseline)}.`);
    }
    text = parts.join(" ") || "Keep walking to see your trend.";
  }
  $("trend-text").textContent = text;
  $("walking-state").textContent = b.walking ? "Walking now" : "Not walking";

  const w = b.last_window || {};
  const set = (id, v, digits, flag) => {
    const el = $(id);
    el.textContent = v == null ? "—" : v.toFixed(digits);
    el.classList.toggle("flag", v != null && flag(v));
  };
  set("m-cadence", w.cadence, 0, (v) => v < 70);
  set("m-cv", w.step_cv, 1, (v) => v > 7);
  set("m-reg", w.regularity, 2, (v) => v < 0.5);
  set("m-sway", w.sway, 2, (v) => v > 1.4);

  drawTrend(b);
  drawDaily(b.daily || []);
}

// ------------------------------------------------------------------ charts

const NS = "http://www.w3.org/2000/svg";
function el(tag, attrs, parent) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
}

function axes(svg, W, H, pad, yFor) {
  for (const v of [0, 50, 100]) {
    const y = yFor(v);
    el("line", { x1: pad.l, x2: W - pad.r, y1: y, y2: y, stroke: "#e2e7da", "stroke-width": 1 }, svg);
    el("text", { x: pad.l - 5, y: y + 3, "text-anchor": "end" }, svg).textContent = v;
  }
  // Risk zone under 50.
  el("rect", { x: pad.l, y: yFor(50), width: W - pad.l - pad.r, height: yFor(0) - yFor(50), fill: "#a5212b", opacity: 0.05 }, svg);
}

function drawTrend(b) {
  const svg = $("trend-chart");
  svg.innerHTML = "";
  const W = 360, H = 170, pad = { l: 26, r: 10, t: 10, b: 20 };
  const yFor = (v) => pad.t + (1 - v / 100) * (H - pad.t - pad.b);
  axes(svg, W, H, pad, yFor);
  const pts = (b.recent || []).filter((p) => !p.sample);
  if (pts.length < 1) {
    el("text", { x: W / 2, y: H / 2, "text-anchor": "middle" }, svg).textContent = "Walk to start the chart";
    return;
  }
  const t0 = pts[0].t;
  const tLast = pts[pts.length - 1].t;
  const projectS = b.slope != null ? 600 : 0;
  const span = Math.max(60, tLast - t0 + projectS);
  const xFor = (t) => pad.l + ((t - t0) / span) * (W - pad.l - pad.r);

  if (b.baseline != null) {
    el("line", { x1: pad.l, x2: W - pad.r, y1: yFor(b.baseline), y2: yFor(b.baseline), stroke: "#3c5a4e", "stroke-dasharray": "1 3", "stroke-width": 1.5 }, svg);
  }
  for (const p of pts) el("circle", { cx: xFor(p.t), cy: yFor(p.score), r: 2.6, fill: "#9caf88" }, svg);

  // Smoothed line (same EWMA as the board).
  let s = null;
  const line = pts.map((p) => { s = s == null ? p.score : 0.3 * p.score + 0.7 * s; return `${xFor(p.t).toFixed(1)},${yFor(s).toFixed(1)}`; });
  el("polyline", { points: line.join(" "), fill: "none", stroke: "#2a4fa8", "stroke-width": 2.5, "stroke-linejoin": "round" }, svg);

  if (b.slope != null && b.projected != null) {
    el("line", { x1: xFor(tLast), y1: yFor(s), x2: xFor(tLast + 600), y2: yFor(b.projected), stroke: "#a85d0b", "stroke-width": 2, "stroke-dasharray": "5 4" }, svg);
    el("text", { x: xFor(tLast + 600), y: yFor(b.projected) - 6, "text-anchor": "end" }, svg).textContent = Math.round(b.projected);
  }
  el("text", { x: pad.l, y: H - 6 }, svg).textContent = fmtTime(t0);
  el("text", { x: xFor(tLast), y: H - 6, "text-anchor": "middle" }, svg).textContent = fmtTime(tLast);
}

function drawDaily(daily) {
  const svg = $("daily-chart");
  svg.innerHTML = "";
  $("daily-empty").hidden = daily.length > 0;
  svg.style.display = daily.length ? "block" : "none";
  if (!daily.length) return;
  const W = 360, H = 120, pad = { l: 26, r: 10, t: 8, b: 18 };
  const yFor = (v) => pad.t + (1 - v / 100) * (H - pad.t - pad.b);
  axes(svg, W, H, pad, yFor);
  const n = daily.length;
  const bw = Math.min(18, (W - pad.l - pad.r) / n - 4);
  daily.forEach((d, i) => {
    const x = pad.l + ((i + 0.5) / n) * (W - pad.l - pad.r);
    const color = d.score < 50 ? "#a5212b" : d.score < 65 ? "#a85d0b" : "#3c5a4e";
    el("rect", { x: x - bw / 2, y: yFor(d.score), width: bw, height: yFor(0) - yFor(d.score), fill: color, opacity: 0.85 }, svg);
    if (i === 0 || i === n - 1 || n <= 7) {
      const [, m, day] = d.day.split("-");
      el("text", { x, y: H - 5, "text-anchor": "middle" }, svg).textContent = `${+m}/${+day}`;
    }
  });
}

function drawLive() {
  const c = $("live");
  const ctx = c.getContext("2d");
  const W = c.width, H = c.height;
  ctx.clearRect(0, 0, W, H);
  const yFor = (g) => H - (g / 2.6) * H;
  ctx.strokeStyle = "#e2e7da";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, yFor(1)); ctx.lineTo(W, yFor(1)); ctx.stroke();
  ctx.fillStyle = "#616d66";
  ctx.font = "18px IBM Plex Mono, monospace";
  ctx.fillText("1 g", 6, yFor(1) - 6);
  const pts = liveMags.slice(-500);
  if (pts.length > 1) {
    ctx.strokeStyle = "#2a4fa8";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    pts.forEach((m, i) => { const x = (i / 499) * W; i ? ctx.lineTo(x, yFor(m)) : ctx.moveTo(x, yFor(m)); });
    ctx.stroke();
    const last = pts[pts.length - 1];
    $("live-meta").textContent = `${last.toFixed(2)} g`;
  }
  requestAnimationFrame(drawLive);
}
requestAnimationFrame(drawLive);

function traceSvg(trace) {
  const W = 300, H = 44;
  const pts = trace.map((m, i) => `${((i / (trace.length - 1)) * W).toFixed(1)},${(H - (Math.min(m, 2.6) / 2.6) * H).toFixed(1)}`).join(" ");
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-label="Acceleration around the event"><polyline points="${pts}" fill="none" stroke="#a5212b" stroke-width="1.5"/></svg>`;
}

// ------------------------------------------------------------------ events

function renderEvents() {
  const list = $("events");
  const shown = events.filter((e) => e.kind !== "settings_saved").slice(-25).reverse();
  $("events-empty").hidden = shown.length > 0;
  $("event-count").textContent = shown.length ? `${shown.length} recent` : "";
  list.innerHTML = shown.map((e) => {
    const [title, cls] = EVENT_INFO[e.kind] || [e.kind, ""];
    let detail = e.detail || "";
    if (e.kind === "emergency") detail = e.detail === "fall" ? "Possible fall with no response" : "Help button";
    else if (/^(peak|angle)=/.test(detail)) detail = humanDetail(detail);
    else if (detail === "button" || detail === "app") detail = detail === "button" ? "From the device button" : "From the dashboard";
    const day = new Date(e.t * 1000).toDateString() === new Date().toDateString() ? "" : fmtDay(e.t) + " ";
    return `<li class="${cls}"><div><span class="ev-title">${esc(title)}</span><span class="ev-time">${day}${fmtTime(e.t)}</span></div>${detail ? `<div class="ev-detail">${esc(detail)}</div>` : ""}${e.trace ? traceSvg(e.trace) : ""}</li>`;
  }).join("");
}

function humanDetail(d) {
  const kv = Object.fromEntries(d.split(" ").map((p) => p.split("=")));
  const out = [];
  if (kv.peak) out.push(`impact ${kv.peak} g`);
  if (kv.freefall === "1") out.push("after a drop");
  if (kv.angle) out.push(`body tilted ${kv.angle}°`);
  return out.join(", ");
}

function showWarning(ev) {
  if (ev.t * 1000 < lastWarningAt) return;
  lastWarningAt = Date.now();
  const box = $("warning");
  box.hidden = false;
  box.classList.toggle("high", ev.risk === "high");
  $("warning-title").textContent = ev.risk === "high" ? "Your balance has dropped a lot" : "Your walking is getting less steady";
  $("warning-text").textContent = ev.detail + (settings.share_with_doctor && ev.risk === "high" ? " Your doctor is being told, as you asked." : "");
}

// ------------------------------------------------------------------ alert overlay

function renderOverlay() {
  const ov = $("overlay");
  const state = status?.device?.state;
  const alert = status?.alert;
  const contact = settings.contact_name || "your emergency contact";
  const actions = [];
  let kicker = "", title = "", count = "", text = "", emergency = false;

  if (state === "fall_check") {
    kicker = "Checking"; title = "Did you fall?"; text = "Hold on, checking whether you're still upright.";
    actions.push(btn("I'm OK", "btn-primary btn-big", () => socket.emit("cancel", {})));
  } else if (state === "fall_countdown" || state === "help_countdown") {
    const isFall = state === "fall_countdown";
    const total = isFall ? (alert?.countdown_s || settings.countdown_s || 30) : 5;
    const left = alert ? Math.max(0, Math.ceil(total - (status.now - alert.t))) : "";
    kicker = isFall ? "Fall detected" : "Help requested";
    title = isFall ? "Are you OK?" : "Asking for help";
    count = String(left);
    text = isFall
      ? `If you don't respond, Steady will alert ${contact}. Press the button on the device or tap below if you're fine.`
      : `Alerting ${contact} when the countdown ends. Press the button again to cancel.`;
    actions.push(btn(isFall ? "I'm OK" : "Cancel", "btn-primary btn-big", () => socket.emit("cancel", {})));
    actions.push(btn("Get help now", "btn-danger btn-big", () => socket.emit("help", {})));
    actions.push(link("Call 911", "tel:911", "btn-outline btn-big"));
  } else if (state === "emergency") {
    emergency = true;
    kicker = "Emergency";
    title = alert?.kind === "fall" ? "Possible fall, no response" : "Help requested";
    text = "If you are hurt or can't get up, call 911 now.";
    actions.push(link("Call 911", "tel:911", "btn-danger btn-big"));
    if (settings.contact_phone) actions.push(link(`Call ${settings.contact_name || "contact"}`, `tel:${settings.contact_phone}`, "btn-outline btn-big"));
    actions.push(btn("Quiet the alarm", "btn-outline btn-big", () => socket.emit("silence", {})));
    actions.push(btn("I'm safe now", "btn-primary btn-big", () => socket.emit("resolve", {})));
  }

  if (!title) { ov.hidden = true; return; }
  ov.hidden = false;
  ov.classList.toggle("emergency", emergency);
  $("ov-kicker").textContent = kicker;
  $("ov-title").textContent = title;
  $("ov-count").textContent = count;
  $("ov-text").textContent = text;
  $("ov-notify").innerHTML = emergency ? notifyStatusHtml() : "";
  const box = $("ov-actions");
  const key = actions.map((a) => a.textContent).join("|");
  if (box.dataset.key !== key) { box.replaceChildren(...actions); box.dataset.key = key; }
}

let lastOutbox = [];
function notifyStatusHtml() {
  const item = [...lastOutbox].reverse().find((i) => i.audience === "contact" && i.priority === "urgent");
  if (!settings.alert_contact || !settings.contact_topic) return "No emergency contact is set up.";
  if (!item) return `Alerting ${esc(settings.contact_name || "your contact")}…`;
  const st = { sent: "✓ notified", relay: "sending…", pending: "sending…", failed: "couldn't send. Call them." }[item.status];
  return `${esc(settings.contact_name || "Your contact")}: <b>${st}</b>`;
}

function btn(label, cls, onClick) {
  const b = document.createElement("button");
  b.className = "btn " + cls;
  b.textContent = label;
  b.onclick = onClick;
  return b;
}
function link(label, href, cls) {
  const a = document.createElement("a");
  a.className = "btn " + cls;
  a.textContent = label;
  a.href = href;
  return a;
}

// ------------------------------------------------------------------ notifications

// The board usually has no internet of its own, so this page sends its alerts.
async function relayOutbox(m) {
  lastOutbox = m.items;
  renderOutbox();
  for (const item of m.items) {
    if (item.status !== "relay" || relayed.has(item.id)) continue;
    relayed.add(item.id);
    let ok = false;
    try {
      const res = await fetch(m.urls[item.id], { method: "POST", body: item.message });
      ok = res.ok;
    } catch { ok = false; }
    socket.emit("relayed", { id: item.id, ok });
  }
}

function renderOutbox() {
  const items = lastOutbox.slice(-6).reverse();
  $("outbox").innerHTML = items.length
    ? items.map((i) => `<li><span>${fmtTime(i.t)} · ${esc(i.audience === "doctor" ? "Doctor" : "Contact")}: ${esc(i.title)}</span><span class="st ${i.status}">${i.status === "relay" ? "sending" : i.status}</span></li>`).join("")
    : "";
}

// ------------------------------------------------------------------ settings & tools

function fillSettings() {
  const f = $("settings");
  for (const input of f.elements) {
    if (!input.name || !(input.name in settings)) continue;
    if (input.type === "checkbox") input.checked = !!settings[input.name];
    else input.value = settings[input.name] ?? "";
  }
}

$("settings").addEventListener("submit", (e) => {
  e.preventDefault();
  const data = {};
  for (const input of e.target.elements) {
    if (!input.name) continue;
    data[input.name] = input.type === "checkbox" ? input.checked : input.value.trim();
  }
  socket.emit("save_settings", data);
  $("saved").hidden = false;
  setTimeout(() => ($("saved").hidden = true), 2000);
});

document.querySelectorAll("[data-test]").forEach((b) => b.addEventListener("click", () => {
  $("settings").requestSubmit();
  setTimeout(() => socket.emit("test_alert", { audience: b.dataset.test }), 300);
}));

document.querySelectorAll("[data-cmd]").forEach((b) => b.addEventListener("click", () => {
  const c = b.dataset.cmd;
  if (c === "clear_history" && !confirm("Delete all walking history and the baseline?")) return;
  socket.emit(c, {});
}));

$("btn-help").addEventListener("click", () => {
  if (confirm(`Send a help alert to ${settings.contact_name || "your emergency contact"} now?`)) socket.emit("help", {});
});

document.querySelector("[data-dismiss=warning]").addEventListener("click", () => ($("warning").hidden = true));

// Keep the countdown ticking between status messages.
setInterval(() => { if (status?.alert) { status.now += 0.25; renderOverlay(); } }, 250);
