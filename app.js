/* Proyección de Pizzas — app estática (sin servidor). Todo se guarda en el dispositivo. */
"use strict";
const $ = id => document.getElementById(id);
const pad = n => String(n).padStart(2, "0");
const iso = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
const dowOf = s => ((new Date(s + "T12:00:00")).getDay() + 6) % 7 + 1;      // 1=Lun … 7=Dom
const fmt = n => Math.round(n).toLocaleString("es-MX");
const DN = ["", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const DL = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const HMIN = 9, HMAX = 23, NH = HMAX - HMIN + 1;      // la curva cubre 09:00 a 23:00
const H0 = 10, H1 = 23;                               // horarios que se capturan
const rng = h => pad(h) + ":00 - " + pad((h + 1) % 24) + ":00";
const RANGE_K = 1.6;                                  // rango ≈80% = total × (1 ∓ 1.6 × error típico a esa hora)
const DEFAULT_MAPE = {10:.045,11:.045,12:.05,13:.046,14:.042,15:.039,16:.036,17:.038,18:.028,19:.023,20:.015,21:.006,22:.006,23:.006};
const GENERIC_SHAPE = [0.002,0.04,0.065,0.115,0.2,0.292,0.39,0.49,0.59,0.71,0.823,0.93,1,1,1]; // curva genérica mientras no cargues la tuya

/* ---------- almacenamiento ---------- */
const KEY = "lcp_v1";
let DB = { active: null, profiles: {} };
function loadDB() { try { const t = JSON.parse(localStorage.getItem(KEY) || "null"); if (t && t.profiles) DB = t; } catch (e) {} }
function saveDB() { try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch (e) {} }
const capsKey = (id, d) => "lcp_caps_" + id + "_" + d;
function loadCaps() { try { const c = JSON.parse(localStorage.getItem(capsKey(DB.active, S.date)) || "{}"); S.caps = c.caps || {}; S.manual = c.manual || ""; } catch (e) { S.caps = {}; S.manual = ""; } }
function saveCaps() { try { localStorage.setItem(capsKey(DB.active, S.date), JSON.stringify({ caps: S.caps, manual: S.manual })); } catch (e) {} }
const P = () => DB.profiles[DB.active];
let S = { date: iso(new Date()), caps: {}, manual: "" };

function newProfile(name, data) {
  const id = "t" + Date.now().toString(36) + Math.floor(Math.random() * 1e3);
  const curve = {}; for (let d = 1; d <= 7; d++) curve[d] = GENERIC_SHAPE.slice();
  DB.profiles[id] = Object.assign({ id, name: name || "Mi tienda", curve, base: {}, dayF: {}, mape: DEFAULT_MAPE, thr: 15, note: "Curva genérica hasta que cargues la tuya (Tienda › Paso 2).", src: {} }, data || {}, { id });
  DB.active = id; saveDB(); return id;
}

/* ---------- análisis de datos ---------- */
const median = a => { const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
const addDays = (s, n) => { const d = new Date(s + "T12:00:00"); d.setDate(d.getDate() + n); return iso(d); };

function parseDaily(text) {
  const m = new Map();
  for (const line of text.split(/\r?\n/)) {
    let d = null, rest = line, a;
    if ((a = line.match(/(\d{4})-(\d{1,2})-(\d{1,2})/))) { d = a[1] + "-" + pad(+a[2]) + "-" + pad(+a[3]); rest = line.replace(a[0], " "); }
    else if ((a = line.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/))) { d = a[3] + "-" + pad(+a[2]) + "-" + pad(+a[1]); rest = line.replace(a[0], " "); }   // DD/MM/AAAA
    if (!d) continue;
    const nums = rest.match(/\d[\d,.]*/g); if (!nums) continue;
    let t = nums[nums.length - 1].replace(/[.,]$/, "");
    t = /^\d{1,3}([.,]\d{3})+$/.test(t) ? t.replace(/[.,]/g, "") : t.split(/[.,]/)[0];
    const v = parseInt(t, 10); if (v > 0) m.set(d, v);
  }
  return [...m].map(([d, v]) => ({ d, v })).sort((x, y) => x.d < y.d ? -1 : 1);
}
function analyzeDaily(series, exclList, auto) {
  const ex = new Set(exclList), bad = [], val = new Map(series.map(p => [p.d, p.v]));
  for (const p of series) {
    if (ex.has(p.d)) { bad.push({ d: p.d, v: p.v, why: "excluido por ti" }); continue; }
    if (auto) {
      const nb = [-21, -14, -7, 7, 14, 21].map(k => val.get(addDays(p.d, k))).filter(x => x != null);
      if (nb.length >= 2) { const md = median(nb), r = p.v / md - 1; if (Math.abs(r) > 0.30) bad.push({ d: p.d, v: p.v, why: (r > 0 ? "+" : "") + Math.round(r * 100) + "% vs. semanas vecinas" }); }
    }
  }
  const badSet = new Set(bad.map(b => b.d)), clean = series.filter(p => !badSet.has(p.d));
  const byDow = {}; clean.forEach(p => (byDow[dowOf(p.d)] = byDow[dowOf(p.d)] || []).push(p));
  const base = {}, all = clean.slice(-28).map(p => p.v), fallback = all.length ? mean(all) : null;
  for (let d = 1; d <= 7; d++) { const a = (byDow[d] || []).slice(-4).map(p => p.v); base[d] = a.length ? Math.round(mean(a)) : (fallback ? Math.round(fallback) : null); }
  // error típico: predecir cada día con el promedio de los 4 mismos días anteriores (últimas 12 semanas)
  const last = clean.length ? clean[clean.length - 1].d : null, errs = [];
  if (last) for (const p of clean) {
    if (p.d < addDays(last, -84)) continue;
    const prev = (byDow[dowOf(p.d)] || []).filter(q => q.d < p.d).slice(-4);
    if (prev.length >= 3) errs.push(Math.abs(mean(prev.map(q => q.v)) - p.v) / p.v);
  }
  return { base, bad, n: series.length, used: clean.length, first: series[0] && series[0].d, last, mape: errs.length ? mean(errs) : null, nErr: errs.length };
}
function parseCurveTable(text) {
  const out = {}; let rows = 0;
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*(\d{1,2}):00\b(.*)$/); if (!m) continue;
    const h = +m[1]; if (h < HMIN || h > HMAX) continue;
    const toks = m[2].trim().split(/\s+/).filter(Boolean);
    let v = null;
    for (const t of toks) if (/^\d{1,4}[.,]\d$/.test(t)) { v = parseFloat(t.replace(",", ".")); break; }   // "4 Week Avg" es la única columna con un decimal
    if (v == null) { const n = toks.filter(t => /^\d+$/.test(t)); if (n.length) v = +n[n.length - 1]; }
    if (v != null) { out[h] = v; rows++; }
  }
  return { vals: out, rows };
}
function cumFrom(vals) {
  const v = Array.from({ length: NH }, (_, i) => vals[HMIN + i] || 0), tot = v.reduce((a, b) => a + b, 0);
  if (!tot) return null; let c = 0; return v.map(x => +((c += x) / tot).toFixed(5));
}

/* ---------- proyección ---------- */
function forecastFor(p, date) {
  const dow = dowOf(date);
  if (S.manual > 0) return { v: +S.manual, src: "manual" };
  if (p.dayF && p.dayF[date] != null) return { v: p.dayF[date], src: "pronóstico guardado para esa fecha" };
  if (p.base && p.base[dow]) return { v: p.base[dow], src: "promedio de 4 semanas del " + DL[dow].toLowerCase() };
  return { v: null, src: "sin pronóstico: escribe uno manual o carga el historial (Tienda › Paso 1)" };
}
function calc() {
  const p = P(), dow = dowOf(S.date), F = forecastFor(p, S.date), cv = p.curve[dow];
  const hs = Object.keys(S.caps).map(Number).filter(h => S.caps[h] != null).sort((a, b) => a - b);
  const r = { dow, F, cv, hs };
  if (!hs.length) return r;
  const h = hs[hs.length - 1], A = S.caps[h], c = cv[h - HMIN];
  r.h = h; r.A = A; r.c = c; r.early = c < .08;
  if (F.v != null) { r.proj = A + (1 - c) * F.v; r.ritmo = c * F.v > 0 ? A / (c * F.v) - 1 : null; }
  else if (c >= .08) { r.proj = A / c; r.ritmo = null; r.noF = true; }
  if (r.proj != null) { const m = (p.mape && p.mape[h]) ?? .05; r.lo = r.proj * (1 - RANGE_K * m); r.hi = r.proj * (1 + RANGE_K * m); }
  return r;
}

/* ---------- vista Hoy ---------- */
function renderHoy() {
  const p = P(), r = calc(), dow = r.dow;
  $("storeName").textContent = p.name;
  $("sub").textContent = DL[dow] + (r.F.v != null ? " · base " + fmt(r.F.v) + " pizzas" : " · sin pronóstico");
  $("fecha").value = S.date;
  const pill = $("pill"); pill.className = "pill";
  const base = r.F.v != null ? r.F.v : null;
  if (r.proj == null) {
    $("big").textContent = base != null ? fmt(base) : "–";
    $("range").textContent = base != null ? "Pronóstico del día (aún sin capturas)" : "Define el pronóstico para empezar";
    pill.textContent = r.hs.length ? "Muy temprano para proyectar" : "Captura tu primera hora";
    ["sAcum", "sRest", "sRitmo"].forEach(i => $(i).textContent = "–");
  } else {
    $("big").textContent = fmt(r.proj);
    $("range").textContent = "Rango probable " + fmt(r.lo) + " a " + fmt(r.hi);
    $("sAcum").textContent = fmt(r.A); $("sRest").textContent = fmt(Math.max(0, r.proj - r.A));
    $("sRitmo").textContent = r.ritmo == null ? "–" : (r.ritmo >= 0 ? "+" : "") + Math.round(r.ritmo * 100) + "%";
    const t = (p.thr || 15) / 100;
    if (r.noF) pill.textContent = "Proyección solo por ritmo del día";
    else if (r.early) pill.textContent = "Muy temprano para ajustar";
    else if (r.ritmo < -t) { pill.className = "pill bad"; pill.textContent = "BAJAR producción"; }
    else if (r.ritmo > t) { pill.className = "pill warn"; pill.textContent = "SUBIR producción"; }
    else { pill.className = "pill ok"; pill.textContent = "MANTENER ritmo"; }
  }
  const ch = $("chips"); ch.innerHTML = "";
  r.hs.forEach(h => {
    const d = document.createElement("span"); d.className = "chip"; d.title = "Tocar para corregir";
    d.innerHTML = rng(h) + " · <b>" + fmt(S.caps[h]) + "</b>";
    d.onclick = () => { $("hora").value = h; $("val").value = S.caps[h]; $("val").focus(); $("val").select(); };
    const b = document.createElement("button"); b.type = "button"; b.setAttribute("aria-label", "Quitar " + rng(h)); b.textContent = "×";
    b.onclick = e => { e.stopPropagation(); delete S.caps[h]; saveCaps(); renderHoy(); };
    d.appendChild(b); ch.appendChild(d);
  });
  const hr = $("hrs"); hr.innerHTML = "";
  const tot = r.proj != null ? r.proj : (base != null ? base : null), from = r.h != null ? r.h + 1 : H0;
  $("restSub").textContent = r.proj != null ? "desde " + pad(from) + ":00 al cierre" : "según el pronóstico";
  if (tot == null) hr.innerHTML = '<span class="note">Define un pronóstico para ver las pizzas por hora.</span>';
  else if (from > H1) hr.innerHTML = '<span class="note">Ya cerró el día.</span>';
  else for (let h = from; h <= H1; h++) {
    const e = tot * (r.cv[h - HMIN] - (r.cv[h - HMIN - 1] || 0));
    const d = document.createElement("div"); d.className = "hr"; d.innerHTML = "<span>" + rng(h) + "</span><b>" + fmt(e) + "</b>"; hr.appendChild(d);
  }
  const wk = $("week"); wk.innerHTML = "";
  for (let i = 0; i < 7; i++) {
    const k = addDays(S.date, i), dw = dowOf(k), v = (p.dayF && p.dayF[k] != null) ? p.dayF[k] : p.base[dw];
    const b = document.createElement("button"); b.className = "day"; b.type = "button"; b.setAttribute("aria-pressed", k === S.date);
    b.innerHTML = DN[dw] + "<b>" + (v != null ? fmt(v) : "–") + "</b>" + (+k.slice(8));
    b.onclick = () => { S.date = k; loadCaps(); initHoy(); }; wk.appendChild(b);
  }
  $("src").textContent = "Pronóstico usado: " + (r.F.v != null ? fmt(r.F.v) + " (" + r.F.src + ")" : r.F.src);
  drawChart(r);
}
function drawChart(r) {
  const W = 340, Hh = 170, L = 34, R = 10, T = 10, B = 22, x0 = 10, x1 = 24;
  const X = h => L + (h + 1 - x0) / (x1 - x0) * (W - L - R);
  const Fv = r.F.v || 0, top = Math.max(Fv, r.proj || 0, ...r.hs.map(h => S.caps[h]), 100) * 1.08, Y = v => T + (1 - v / top) * (Hh - T - B);
  let s = ""; const step = top > 800 ? 250 : top > 400 ? 100 : 50;
  for (let v = 0; v <= top; v += step) s += `<line class="grid" x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}"/><text class="ax" x="${L - 4}" y="${Y(v) + 3}" text-anchor="end">${v}</text>`;
  for (let k = 12; k <= 24; k += 2) s += `<text class="ax" x="${X(k - 1)}" y="${Hh - 6}" text-anchor="middle">${k}</text>`;
  if (Fv) { let p = ""; for (let h = 9; h <= 23; h++) p += (p ? "L" : "M") + X(h).toFixed(1) + " " + Y(Fv * r.cv[h - HMIN]).toFixed(1); s += `<path d="${p}" fill="none" stroke="var(--mute)" stroke-width="1.5" stroke-dasharray="4 4"/>`; }
  if (r.proj != null) {
    let p = ""; for (let h = r.h; h <= 23; h++) { const y = h === r.h ? r.A : r.A + (r.proj - r.A) * (r.cv[h - HMIN] - r.c) / ((1 - r.c) || 1); p += (p ? "L" : "M") + X(h).toFixed(1) + " " + Y(y).toFixed(1); }
    s += `<path d="${p}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-dasharray="1 4" stroke-linecap="round"/>`;
    let q = ""; r.hs.forEach(h => q += (q ? "L" : "M") + X(h).toFixed(1) + " " + Y(S.caps[h]).toFixed(1));
    s += `<path d="${q}" fill="none" stroke="var(--accent)" stroke-width="2.5"/>`;
    r.hs.forEach(h => s += `<circle cx="${X(h)}" cy="${Y(S.caps[h])}" r="3.5" fill="var(--accent)"/>`);
    s += `<circle cx="${X(23)}" cy="${Y(r.proj)}" r="4" fill="var(--card)" stroke="var(--accent)" stroke-width="2"/>`;
  }
  $("svg").innerHTML = s;
}
function initHoy() {
  const sel = $("hora"); if (!sel.options.length) for (let h = H0; h <= H1; h++) { const o = document.createElement("option"); o.value = h; o.textContent = rng(h); sel.appendChild(o); }
  const hs = Object.keys(S.caps).map(Number), n = new Date().getHours();
  sel.value = hs.length ? Math.min(H1, Math.max(...hs) + 1) : (S.date === iso(new Date()) ? Math.min(H1, Math.max(H0, n - 1)) : H0);
  $("manual").value = S.manual || ""; $("thr").value = P().thr || 15; $("val").value = ""; $("msg").textContent = "";
  renderHoy();
}

/* ---------- vista Tienda ---------- */
function renderTienda() {
  const p = P(), sel = $("selStore"); sel.innerHTML = "";
  Object.values(DB.profiles).forEach(q => { const o = document.createElement("option"); o.value = q.id; o.textContent = q.name; sel.appendChild(o); });
  sel.value = DB.active; $("inName").value = p.name; $("profNote").textContent = p.note || "";
  $("taDaily").value = (p.src && p.src.daily) || ""; $("inExcl").value = (p.src && p.src.excl) || ""; $("ckAuto").checked = !(p.src && p.src.auto === false);
  const box = $("curveBoxes"); box.innerHTML = "";
  for (let d = 1; d <= 7; d++) {
    const det = document.createElement("details"); det.className = "curvebox";
    const has = p.src && p.src.curves && p.src.curves[d];
    det.innerHTML = `<summary>${DL[d]} ${has ? "✓" : ""}</summary><textarea id="ta${d}" placeholder="Pega aquí la tabla Round Pizza de un ${DL[d].toLowerCase()}"></textarea>`;
    box.appendChild(det); det.querySelector("textarea").value = has || "";
  }
  $("outDaily").innerHTML = p.src && p.src.dailyOut || ""; $("outCurve").innerHTML = p.src && p.src.curveOut || "";
  $("btnDelete").textContent = "Eliminar esta tienda"; $("btnDelete").dataset.armed = "";
}
function runDaily() {
  const p = P(), text = $("taDaily").value, series = parseDaily(text);
  if (series.length < 14) { $("outDaily").innerHTML = '<span class="bad">Necesito al menos 14 días con fecha y pizzas (' + series.length + ' leídos). Revisa el formato.</span>'; return; }
  const ex = $("inExcl").value.split(/[\s,;]+/).filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x)), auto = $("ckAuto").checked;
  const a = analyzeDaily(series, ex, auto);
  p.base = a.base; p.src = Object.assign(p.src || {}, { daily: text, excl: $("inExcl").value, auto });
  if (a.mape != null) p.note = "Error típico del pronóstico diario: " + (a.mape * 100).toFixed(1) + "% (probado en " + a.nErr + " días).";
  let h = `<p>${a.n} días leídos (${a.first} a ${a.last}); ${a.used} usados.` + (a.mape != null ? ` Error típico al predecir cada día con el promedio de 4 semanas: <b>${(a.mape * 100).toFixed(1)}%</b>.` : "") + `</p><table><tr><th>Día</th><th>Pizzas base</th></tr>`;
  for (let d = 1; d <= 7; d++) h += `<tr><td>${DL[d]}</td><td>${a.base[d] != null ? fmt(a.base[d]) : "–"}</td></tr>`;
  h += "</table>";
  if (a.bad.length) h += `<p class="note" style="margin-top:8px">Días que no cuentan: ${a.bad.map(b => `${b.d} (${b.v}, ${b.why})`).join("; ")}</p>`;
  p.src.dailyOut = h; $("outDaily").innerHTML = h; saveDB(); $("profNote").textContent = p.note;
}
function runCurve() {
  const p = P(), got = {}, texts = {}; let msg = "";
  for (let d = 1; d <= 7; d++) {
    const t = $("ta" + d).value.trim(); if (!t) continue;
    const { vals, rows } = parseCurveTable(t);
    if (rows < 8) { msg += `<p class="bad">${DL[d]}: leí solo ${rows} horas. Copia la tabla completa de Round Pizza.</p>`; continue; }
    const c = cumFrom(vals); if (c) { got[d] = c; texts[d] = t; }
  }
  const ks = Object.keys(got); if (!ks.length) { $("outCurve").innerHTML = msg || '<span class="bad">Pega al menos una tabla.</span>'; return; }
  const avg = Array.from({ length: NH }, (_, i) => mean(ks.map(k => got[k][i])));
  for (let d = 1; d <= 7; d++) p.curve[d] = got[d] || avg.map(x => +x.toFixed(5));
  p.src = Object.assign(p.src || {}, { curves: texts });
  p.note = (p.note && p.note.startsWith("Error") ? p.note + " " : "") + "Curva por hora: " + ks.length + " de 7 días cargados" + (ks.length < 7 ? " (los demás usan el promedio)." : ".");
  let h = msg + `<p>${ks.length} de 7 días cargados. Ya lleva en cada hora, en % del día:</p><table><tr><th>Horario</th>${[1,2,3,4,5,6,7].map(d => "<th>" + DN[d] + "</th>").join("")}</tr>`;
  [12, 15, 18, 21].forEach(hh => { h += `<tr><td>hasta ${pad(hh + 1)}:00</td>` + [1,2,3,4,5,6,7].map(d => `<td>${Math.round(p.curve[d][hh - HMIN] * 100)}%</td>`).join("") + "</tr>"; });
  h += "</table>"; p.src.curveOut = h; $("outCurve").innerHTML = h; saveDB(); $("profNote").textContent = p.note;
}

/* ---------- compartir ---------- */
const exportData = p => ({ name: p.name, curve: Object.fromEntries(Object.entries(p.curve).map(([k, v]) => [k, v.map(x => +(+x).toFixed(4))])), base: p.base, dayF: p.dayF || {}, mape: p.mape, thr: p.thr, note: p.note || "" });
function validate(o) {
  if (!o || typeof o !== "object" || !o.curve || !o.base) return "Falta curve o base.";
  for (let d = 1; d <= 7; d++) { const c = o.curve[d]; if (!Array.isArray(c) || c.length !== NH || c.some(x => typeof x !== "number" || !isFinite(x))) return "La curva del día " + d + " no es válida."; }
  return null;
}
function copy(text, msgEl, okMsg) {
  const fail = () => { $("taImport").value = text; $("taImport").select(); msgEl.textContent = "Selecciona y copia el texto de la caja de abajo."; };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => msgEl.textContent = okMsg, fail); else fail();
}
const b64e = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64d = s => decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/"))));
function importObj(o, say) {
  const err = validate(o); if (err) { say("No pude importar: " + err); return false; }
  newProfile(o.name || "Tienda importada", { curve: o.curve, base: o.base, dayF: o.dayF || {}, mape: o.mape || DEFAULT_MAPE, thr: o.thr || 15, note: o.note || "", src: {} });
  return true;
}

/* ---------- navegación y eventos ---------- */
function show(v) {
  $("vHoy").hidden = v !== "hoy"; $("vTienda").hidden = v !== "tienda";
  $("tabHoy").setAttribute("aria-current", v === "hoy" ? "page" : "false"); $("tabTienda").setAttribute("aria-current", v === "tienda" ? "page" : "false");
  if (v === "tienda") renderTienda(); else { loadCaps(); initHoy(); }
  window.scrollTo(0, 0);
}
$("tabHoy").onclick = () => show("hoy"); $("tabTienda").onclick = () => show("tienda");
$("form").addEventListener("submit", e => {
  e.preventDefault();
  const h = +$("hora").value, v = $("val").value === "" ? NaN : Math.round(+$("val").value);
  if (!(v >= 0)) { $("msg").textContent = "Escribe cuántas pizzas llevas acumuladas."; return; }
  const ks = Object.keys(S.caps).map(Number), prev = ks.filter(k => k < h).sort((a, b) => b - a)[0], nxt = ks.filter(k => k > h).sort((a, b) => a - b)[0];
  let warn = "";
  if (prev != null && v < S.caps[prev]) warn = "Ojo: es menos que lo de " + rng(prev) + " (" + S.caps[prev] + "). Se guardó igual; corrígelo si fue error.";
  else if (nxt != null && v > S.caps[nxt]) warn = "Ojo: es más que lo de " + rng(nxt) + " (" + S.caps[nxt] + "). Se guardó igual; corrígelo si fue error.";
  S.caps[h] = v; saveCaps(); initHoy(); $("msg").textContent = warn; $("val").focus();
});
$("fecha").addEventListener("change", e => { if (e.target.value) { S.date = e.target.value; loadCaps(); initHoy(); } });
$("manual").addEventListener("input", e => { S.manual = e.target.value; saveCaps(); renderHoy(); });
$("thr").addEventListener("input", e => { P().thr = Math.max(1, +e.target.value || 15); saveDB(); renderHoy(); });
$("reset").addEventListener("click", () => { S.caps = {}; saveCaps(); initHoy(); });
$("selStore").addEventListener("change", e => { DB.active = e.target.value; saveDB(); renderTienda(); });
$("inName").addEventListener("input", e => { P().name = e.target.value || "Mi tienda"; saveDB(); });
$("btnNew").onclick = () => { newProfile("Tienda nueva"); renderTienda(); $("inName").focus(); $("inName").select(); };
$("btnDaily").onclick = runDaily; $("btnCurve").onclick = runCurve;
$("btnLink").onclick = () => { const u = location.href.split("#")[0] + "#cfg=" + b64e(JSON.stringify(exportData(P()))); copy(u, $("msgShare"), "Enlace copiado. Mándalo por WhatsApp o correo."); };
$("btnExport").onclick = () => copy(JSON.stringify(exportData(P())), $("msgShare"), "Configuración copiada.");
$("btnImport").onclick = () => { try { const o = JSON.parse($("taImport").value); if (importObj(o, m => $("msgShare").textContent = m)) { $("taImport").value = ""; renderTienda(); $("msgShare").textContent = "Tienda importada."; } } catch (e) { $("msgShare").textContent = "Eso no parece una configuración válida."; } };
$("btnDemo").onclick = () => fetch("presets/garbancera.json").then(r => r.json()).then(o => { if (importObj(o, m => $("msgShare").textContent = m)) { renderTienda(); $("msgShare").textContent = "Ejemplo cargado."; } }).catch(() => $("msgShare").textContent = "No pude cargar el ejemplo (necesita abrirse desde un sitio web, no desde un archivo).");
$("btnDelete").onclick = e => {
  const b = e.currentTarget; if (!b.dataset.armed) { b.dataset.armed = "1"; b.textContent = "¿Seguro? Toca otra vez para eliminar"; return; }
  delete DB.profiles[DB.active]; const ids = Object.keys(DB.profiles); if (ids.length) DB.active = ids[0]; else newProfile("Mi tienda"); saveDB(); renderTienda();
};

/* ---------- arranque ---------- */
function boot() {
  loadDB();
  const m = location.hash.match(/^#cfg=(.+)$/); let incoming = null;
  if (m) { try { incoming = JSON.parse(b64d(m[1])); } catch (e) {} history.replaceState(null, "", location.pathname + location.search); }
  const first = !Object.keys(DB.profiles).length || !DB.profiles[DB.active];
  if (first) { if (Object.keys(DB.profiles).length) DB.active = Object.keys(DB.profiles)[0]; else newProfile("Mi tienda"); }
  loadCaps();
  if (incoming && !validate(incoming)) {
    const bn = $("banner"); bn.hidden = false; bn.innerHTML = `<span>Importar la tienda «${incoming.name || "sin nombre"}»?</span><span><button id="bnOk">Guardar</button> <button id="bnNo">No</button></span>`;
    $("bnOk").onclick = () => { importObj(incoming, () => {}); bn.hidden = true; loadCaps(); show("hoy"); };
    $("bnNo").onclick = () => bn.hidden = true;
  }
  const p = P(); const empty = !Object.keys(p.base || {}).length && !(p.src && p.src.curves);
  if (empty && !incoming) show("tienda"); else show("hoy");
}
boot();
