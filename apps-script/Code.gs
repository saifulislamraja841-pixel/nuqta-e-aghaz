/**
 * NUQTA-E-AGHAZ — Google Apps Script backend
 * -------------------------------------------------------------
 * Paste this whole file into the Apps Script editor of your MASTER
 * spreadsheet (the one all your Google Forms send responses to):
 *   Spreadsheet → Extensions → Apps Script → replace Code.gs → Save.
 * Then run `setup` once, and deploy as a Web App (see SETUP.md).
 */

/* ======================= EDIT THESE ======================= */
const ADMIN_KEY = "change-this-to-a-long-secret";        // password for the team dashboard
const SITE_URL  = "https://www.nuqtaeaghaz.org/";        // where index.html is hosted (ends with /)
const SEND_AMBASSADOR_EMAIL = true;                       // email new ambassadors their reference number + portal login

/* Labels for each form (used in the dashboard) */
const TABS = {
  main:        "Main Event",
  ambassador:  "Ambassadors",
  competitions:"Competitions",
  talent:      "Talent Award",
  stall:       "Stalls",
};
const ANN_TAB = "Announcements";
/* Your existing Google Forms (the id between /d/ and /edit in the form's edit link) */
const FORM_IDS = {
  main:         "1kJBEDmjI8OOd1b74eWh59VjPNrvVxfPeLBrMFS-tBLA",   // Fiesta (Participants) Registration
  talent:       "1i0rWdSEtUtZt5hvKyZlXgEgXs21JVNTjF7j5u128geI",   // UET Talent Award 2026
  ambassador:   "1Bqs-XiIk80YuAV51vBtzQQLhhdT5dsLZ6K_C72IHBoY",   // UET Ambassador Registration
  competitions: "15u_eCT5mSdqM9g7YgKIjjf2ZcmDlgMiEm45PQS2LpZo",   // Competitions Form
  stall:        "1XnM0T57cLLN9I_4Dum2zpbtLAC6BzN4Bx0D69ckMx14",   // Stall Booking (created by the site)
};
const CODE_PREFIX = "NEA";   // only used if the Reference Number column is empty; otherwise the
const CODE_DIGITS = 2;       // highest number already in the sheet sets the format (NEA40 → NEA41, NEA99 → NEA100)
const COMPETITIONS = [
  ["Qirat", /qir|recitation/i],
  ["Naat", /naat|na'at|\bnat\b/i],
  ["Urdu Debate", /urdu.*debat/i],
  ["English Debate", /english.*debat/i],
  ["Painting", /paint/i],
  ["Calligraphy", /cal+ig+ra/i],
];
/* ========================================================== */

/* Column detection — works with whatever wording your forms use */
const COL = {
  email: /e-?mail/i,
  name: /^(full\s*)?name|your name|student name|name of/i,
  phone: /phone|whats\s*app|contact|mobile|cell/i,
  ref: /referr|ambassador.*code|ref(erral)?\s*code|code.*ambassador/i,
  comp: /competition|which.*(event|contest)|category/i,
  uni: /universit|institut|college|campus/i,
  code: /^ambassador code$/i,
  status: /^status$/i,
};

/* -------------------- one-time setup -------------------- */
/* Responses are read straight from the Google Forms (all old + new ones).
   Ambassador reference numbers, portal passwords and duplicate flags live in the
   Ambassador form's own response sheet (columns Reference Number, Portal Password,
   Login Sent, Status). This spreadsheet keeps the announcements. */
function setup() {
  annSheet_();
  syncAmbassadors_(false);                                   // number existing rows, no emails
  PropertiesService.getScriptProperties().setProperty("LOGIN_EMAILS_FROM", String(Date.now()));
  ScriptApp.getProjectTriggers().forEach(tr => ScriptApp.deleteTrigger(tr));
  Object.keys(FORM_IDS).forEach(k => {
    ScriptApp.newTrigger("onAnySubmit").forForm(FORM_IDS[k]).onFormSubmit().create();
    Logger.log("✓ " + TABS[k] + ": " + FormApp.openById(FORM_IDS[k]).getResponses().length + " responses");
  });
  ScriptApp.newTrigger("onAmbassadorRow").forSpreadsheet(ambSheet_().getParent()).onFormSubmit().create();
  ScriptApp.newTrigger("refreshAll").timeBased().everyMinutes(5).create();
  refreshAll();
  Logger.log("✅ Setup complete. Now Deploy → New deployment → Web app.");
}

/* Runs on every form submission (installed by setup) */
function onAnySubmit(e) {
  CacheService.getScriptCache().removeAll(["stats"].concat(Object.keys(TABS).map(k => "rows_" + k)));
  refreshAll();
}
/* Runs when a new row lands in the Ambassador response sheet */
function onAmbassadorRow() {
  syncAmbassadors_(SEND_AMBASSADOR_EMAIL);
  CacheService.getScriptCache().removeAll(["stats", "rows_ambassador"]);
}

/* Reads every form once and keeps the results ready, so the dashboard and portal open instantly.
   setup() runs this every 5 minutes; it also runs after each form submission. */
const CACHE_SECONDS = 6 * 3600;
function refreshAll() {
  syncAmbassadors_(SEND_AMBASSADOR_EMAIL);                  // catches any row the submit trigger missed
  const cache = CacheService.getScriptCache();
  cache.removeAll(["stats"].concat(Object.keys(TABS).map(k => "rows_" + k)));
  Object.keys(TABS).forEach(k => readTab_(k));
  stats_();
}

/* Run this ONCE by hand to email every existing ambassador their reference number,
   username and password. Skips anyone already emailed (Login Sent filled in).
   Gmail allows about 100 emails a day from a normal account; run again tomorrow if it stops. */
function emailLoginsToExistingAmbassadors() {
  const n = syncAmbassadors_(true, true);
  Logger.log("Emails sent: " + n + ". Remaining Gmail quota today: " + MailApp.getRemainingDailyQuota());
}

/* -------------------- ambassador reference numbers -------------------- */
/* The Ambassador form's response sheet is the source of truth:
   - Reference Number: numbers you typed by hand are kept as they are. Every new row gets
     the next number after the highest one (NEA40 → NEA41 …). Numbers are never reused or changed.
   - Only UET students get a number: their campus must be one of the form's campus options.
     Anyone who picked "Other" (e.g. UOL City Campus) gets Status "Not UET - no ambassador number".
   - Status: write "rejected" to remove someone. Repeat sign-ups (same email, WhatsApp
     number or UET registration number as an earlier row) get "Duplicate of NEAxx" and no number.
   - Portal Password: made automatically. Username = the reference number.
   - Login Sent: when the login email went out. Clear it to send the email again. */
const AMB_COLS = { ref: "Reference Number", pass: "Portal Password", sent: "Login Sent", status: "Status" };
function ambSheet_() {
  const ss = SpreadsheetApp.openById(FormApp.openById(FORM_IDS.ambassador).getDestinationId());
  const id = FORM_IDS.ambassador;
  return ss.getSheets().find(s => String(s.getFormUrl() || "").indexOf(id) >= 0)
      || ss.getSheets().find(s => /timestamp/i.test(String(s.getRange(1, 1).getValue()))) || ss.getSheets()[0];
}
/* Finds (or creates) the columns the script needs; returns 0-based indexes */
function ambColumns_(sh, head, data) {
  const H = head.map(h => String(h).trim());
  const find = re => H.findIndex(h => re.test(h));
  let ref = find(/^ref(erence)?\s*(no|number|#|code)?\.?$|reference/i);
  if (ref < 0) ref = H.findIndex((h, c) => !/timestamp|email/i.test(h) && data.some(r => /^NEA\s*-?\d+$/i.test(String(r[c]).trim())));
  if (ref >= 0 && H[ref] !== AMB_COLS.ref) sh.getRange(1, ref + 1).setValue(AMB_COLS.ref);
  const idx = { ref, email: find(/e-?mail/i), name: find(/^(full\s*)?name/i), phone: find(/phone|whats\s*app|mobile|contact/i),
    reg: find(/registration\s*(no|number)|roll/i), campus: find(/campus|universit/i), pass: find(/^portal password$/i), sent: find(/^login sent$/i), status: find(/^status$/i), ts: find(/^timestamp$/i) };
  ["ref", "pass", "sent", "status"].forEach(k => {
    if (idx[k] >= 0) return;
    const c = sh.getLastColumn() + 1;
    sh.getRange(1, c).setValue(AMB_COLS[k]).setFontWeight("bold");
    idx[k] = c - 1;
  });
  return idx;
}
function refKey_(s) {                         // NEA07, nea-7, "7" and NEA007 all mean the same ambassador
  const m = String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "").match(/^[A-Z]*?0*(\d+)$/);
  return m ? "#" + Number(m[1]) : "";
}
function newPassword_() {
  const a = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let p = ""; for (let i = 0; i < 8; i++) p += a[Math.floor(Math.random() * a.length)];
  return p;
}
/* Numbers new rows, flags duplicates, makes passwords and (optionally) sends login emails.
   Safe to run any number of times. Returns how many emails were sent. */
function syncAmbassadors_(sendEmail, includeOld) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return 0;
  try {
    const sh = ambSheet_(), all = sh.getDataRange().getValues();
    if (all.length < 2) return 0;
    const data = all.slice(1), C = ambColumns_(sh, all[0], data);
    const width = Math.max(sh.getLastColumn(), all[0].length);
    const rows = data.map(r => { r = r.slice(); while (r.length < width) r.push(""); return r; });
    const cell = (r, k) => C[k] >= 0 ? String(r[C[k]] == null ? "" : r[C[k]]).trim() : "";
    // format of the highest existing number decides the next one (NEA40 → NEA41)
    let best = { prefix: CODE_PREFIX, n: 0, width: CODE_DIGITS };
    rows.forEach(r => { const m = cell(r, "ref").match(/^(.*?)(\d+)$/); if (m && +m[2] > best.n) best = { prefix: m[1], n: +m[2], width: m[2].length }; });
    const used = new Set(rows.map(r => refKey_(cell(r, "ref"))).filter(Boolean));
    const from = includeOld ? 0 : Number(PropertiesService.getScriptProperties().getProperty("LOGIN_EMAILS_FROM") || Date.now());
    const seen = {}, keysOf = r => {
      const k = [], e = cell(r, "email").toLowerCase(), p = cell(r, "phone").replace(/\D/g, "").slice(-10), g = cell(r, "reg").toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (e) k.push("e:" + e); if (p.length >= 7) k.push("p:" + p); if (g.length >= 4) k.push("g:" + g);
      return k;
    };
    // Only UET students are ambassadors: the campus must be one of the form's own options
    // (Main Campus, KSK Campus, UET RCET Campus …). An "Other" answer such as "UOL City Campus" gets no number.
    const uetCampuses = campusChoices_();
    const isUet = r => {
      const c = cell(r, "campus"), all = (c + " " + cell(r, "reg")).toLowerCase();
      if (/not\s+(in|from|of)\s+uet/.test(all)) return false;
      return !c || !uetCampuses.length || uetCampuses.indexOf(c.toLowerCase()) >= 0 || /\buet\b/i.test(c);
    };
    let sent = 0;
    const edits = [], set = (r, k, v) => { r[C[k]] = v; edits.push([rows.indexOf(r), C[k], v]); };
    rows.forEach(r => {
      const status = cell(r, "status").toLowerCase(), keys = keysOf(r);
      let ref = cell(r, "ref");
      if (/reject/.test(status)) return;
      if (!ref && !isUet(r)) {                              // not a UET student: never numbered
        if (!status) set(r, "status", "Not UET - no ambassador number");
        return;
      }
      const firstRef = keys.map(k => seen[k]).find(Boolean);
      if (!ref && firstRef) {                               // repeat sign-up: no new number
        if (!status) set(r, "status", "Duplicate of " + firstRef);
        if (sendEmail && !cell(r, "sent") && r[C.ts] instanceof Date && r[C.ts].getTime() > from && MailApp.getRemainingDailyQuota() > 0) {
          const orig = rows.find(o => cell(o, "ref") === firstRef);
          if (sendLoginEmail_(cell(r, "email"), cell(r, "name"), firstRef, orig ? cell(orig, "pass") : "", true)) { set(r, "sent", new Date()); sent++; }
        }
        return;
      }
      if (/^duplicate|not uet/.test(status)) return;        // the team marked it by hand
      if (!ref) {
        do { best.n++; ref = best.prefix + String(best.n).padStart(best.width, "0"); } while (used.has(refKey_(ref)));
        used.add(refKey_(ref)); set(r, "ref", ref);
      }
      keys.forEach(k => { if (!seen[k]) seen[k] = ref; });
      if (!cell(r, "pass")) set(r, "pass", newPassword_());
      const isNew = r[C.ts] instanceof Date ? r[C.ts].getTime() > from : includeOld;
      if (sendEmail && isNew && !cell(r, "sent") && cell(r, "email") && MailApp.getRemainingDailyQuota() > 0) {
        if (sendLoginEmail_(cell(r, "email"), cell(r, "name"), ref, cell(r, "pass"), false)) { set(r, "sent", new Date()); sent++; }
      }
    });
    // write only the cells that changed: reference numbers already in the sheet are never rewritten
    edits.forEach(([i, c, v]) => sh.getRange(i + 2, c + 1).setValue(v));
    return sent;
  } finally { lock.releaseLock(); }
}
/* The campus options listed in the Ambassador form (lower-case) */
function campusChoices_() {
  try {
    const it = FormApp.openById(FORM_IDS.ambassador).getItems().find(i => /campus|universit/i.test(i.getTitle()));
    if (!it) return [];
    const t = it.getType(), T = FormApp.ItemType;
    const q = t === T.MULTIPLE_CHOICE ? it.asMultipleChoiceItem() : t === T.LIST ? it.asListItem() : t === T.CHECKBOX ? it.asCheckboxItem() : null;
    return q ? q.getChoices().map(c => String(c.getValue()).trim().toLowerCase()) : [];
  } catch (e) { return []; }
}
/* Reference number, password and status for every ambassador, keyed by email */
function ambRows_() {
  const sh = ambSheet_(), all = sh.getDataRange().getValues();
  if (all.length < 2) return [];
  const H = all[0].map(h => String(h).trim()), f = re => H.findIndex(h => re.test(h));
  const c = { ref: f(/^reference number$/i), pass: f(/^portal password$/i), status: f(/^status$/i), email: f(/e-?mail/i), name: f(/^(full\s*)?name/i) };
  const v = (r, k) => c[k] >= 0 ? String(r[c[k]] == null ? "" : r[c[k]]).trim() : "";
  return all.slice(1).map(r => ({ email: v(r, "email").toLowerCase(), name: v(r, "name"), code: v(r, "ref"), pass: v(r, "pass"), status: v(r, "status").toLowerCase() }))
    .filter(a => a.email && a.code && !/reject|duplicate/.test(a.status));
}
function sendLoginEmail_(to, name, ref, pass, duplicate) {
  try {
    const link = SITE_URL + "index.html?ref=" + encodeURIComponent(ref), portal = SITE_URL + "portal.html";
    const intro = duplicate
      ? "You have already registered as a Nuqta-e-Aghaz Campus Ambassador, so we have not created a second entry. Here are your existing details:"
      : "Welcome to the Nuqta-e-Aghaz Campus Ambassador Program! Here are your details:";
    MailApp.sendEmail({
      to: String(to).trim(),
      subject: (duplicate ? "You're already registered: " : "Your Nuqta-e-Aghaz Ambassador Login: ") + ref,
      htmlBody: "Assalam o Alaikum " + (name || "") + ",<br><br>" + intro + "<br><br>" +
        "<table style='border-collapse:collapse;font-size:15px'>" +
        "<tr><td style='padding:4px 14px 4px 0'>Reference number</td><td><b style='font-size:18px'>" + ref + "</b></td></tr>" +
        "<tr><td style='padding:4px 14px 4px 0'>Portal username</td><td><b>" + ref + "</b></td></tr>" +
        (pass ? "<tr><td style='padding:4px 14px 4px 0'>Portal password</td><td><b style='font-family:monospace;font-size:16px'>" + pass + "</b></td></tr>" : "") +
        "<tr><td style='padding:4px 14px 4px 0'>Sign in here</td><td><a href='" + portal + "'>" + portal + "</a></td></tr></table><br>" +
        "Your referral link: <a href='" + link + "'>" + link + "</a><br>" +
        "Ask friends to enter <b>" + ref + "</b> in the \"Ambassador Referral Code\" field, or share your link and it is filled in for them. " +
        "Your portal shows your referrals and rank.<br><br>Please don't share your password.<br><br>— Team Nuqta-e-Aghaz",
    });
    return true;
  } catch (err) { Logger.log("Email failed: " + err); return false; }
}

/* -------------------- reading the forms -------------------- */
function readForm_(key) {
  const id = FORM_IDS[key];
  if (!id) return [];
  const items = FormApp.openById(id).getResponses();
  return items.map(resp => {
    const o = { ts: resp.getTimestamp(), email: String(resp.getRespondentEmail() || "").trim().toLowerCase(), name: "", phone: "", ref: "", comp: "", uni: "" };
    resp.getItemResponses().forEach(ir => {
      const t = ir.getItem().getTitle(), raw = ir.getResponse(), v = String(Array.isArray(raw) ? raw.join(", ") : raw == null ? "" : raw).trim();
      if (!o.email && COL.email.test(t)) o.email = v.toLowerCase();
      else if (!o.name && COL.name.test(t) && !COL.uni.test(t)) o.name = v;
      else if (!o.phone && COL.phone.test(t)) o.phone = v.replace(/\D/g, "");
      else if (!o.ref && COL.ref.test(t)) o.ref = v.toUpperCase();
      else if (!o.comp && COL.comp.test(t)) o.comp = v;
      else if (!o.uni && COL.uni.test(t)) o.uni = v;
    });
    return o;
  });
}
/* Rows for one form, with ambassador codes attached; cached for 2 minutes */
function readTab_(key) {
  const cache = CacheService.getScriptCache(), hit = cache.get("rows_" + key);
  let rows;
  if (hit) rows = JSON.parse(hit).map(r => (r.ts = new Date(r.ts), r));
  else {
    rows = readForm_(key);
    try { cache.put("rows_" + key, JSON.stringify(rows), CACHE_SECONDS); } catch (e) { /* too big to cache */ }
  }
  if (key === "ambassador") {
    const byEmail = {}; ambRows_().forEach(c => (byEmail[c.email] = c));
    rows = rows.filter(r => byEmail[r.email]).map(r => Object.assign({}, r, { code: byEmail[r.email].code }));
  }
  return rows;
}
function compsOf_(s) { return COMPETITIONS.filter(c => c[1].test(s)).map(c => c[0]); }
function dayKey_(d) { return Utilities.formatDate(d, "Asia/Karachi", "yyyy-MM-dd"); }

/* -------------------- STATS (dashboard) -------------------- */
function stats_() {
  const cache = CacheService.getScriptCache(), hit = cache.get("stats");
  if (hit) return JSON.parse(hit);
  const D = {}; Object.keys(TABS).forEach(k => (D[k] = readTab_(k)));
  const mainEmails = new Set(D.main.map(r => r.email).filter(Boolean));
  const uniq = rows => { const s = new Set(); return rows.filter(r => { const k = r.email || r.phone || r.name; if (!k || s.has(k)) return false; s.add(k); return true; }); };
  const cross = rows => { const u = uniq(rows); return { total: u.length, inMain: u.filter(r => r.email && mainEmails.has(r.email)).length }; };

  const amb = uniq(D.ambassador).filter(a => a.code);
  const byCode = {}; amb.forEach(a => (byCode[refKey_(a.code)] = { code: a.code, name: a.name, university: a.uni, main: 0, competitions: 0, talent: 0, total: 0 }));
  let invalid = 0;
  [["main", D.main], ["competitions", D.competitions], ["talent", D.talent]].forEach(([k, rows]) => uniq(rows).forEach(r => {
    if (!r.ref) return;
    const a = byCode[refKey_(r.ref)];
    if (a) { a[k]++; a.total++; } else invalid++;
  }));
  const leaderboard = Object.values(byCode).sort((a, b) => b.total - a.total || a.code.localeCompare(b.code));

  const compCount = {}; COMPETITIONS.forEach(c => (compCount[c[0]] = 0));
  let entries = 0;
  uniq(D.competitions).forEach(r => compsOf_(r.comp).forEach(c => { compCount[c]++; entries++; }));

  const uniCount = {};
  uniq(D.main).forEach(r => { const u = r.uni || "Not specified"; uniCount[u] = (uniCount[u] || 0) + 1; });

  const timeline = [], all = [].concat(D.main, D.ambassador, D.competitions, D.talent, D.stall);
  for (let i = 29; i >= 0; i--) {
    const k = dayKey_(new Date(Date.now() - i * 864e5));
    timeline.push({ date: k, main: D.main.filter(r => dayKey_(r.ts) === k).length, all: all.filter(r => dayKey_(r.ts) === k).length });
  }
  const label = { main: "Main event", ambassador: "Ambassador", competitions: "Competition", talent: "Talent award", stall: "Stall" };
  const recent = [];
  Object.keys(TABS).forEach(k => D[k].slice(-10).forEach(r => recent.push({ ts: r.ts, name: r.name || r.email, type: label[k], university: r.uni, ref: r.ref })));
  recent.sort((a, b) => b.ts - a.ts);

  const out = {
    generatedAt: new Date().toISOString(),
    totals: { main: uniq(D.main).length, ambassadors: amb.length, referred: uniq(D.main).filter(r => r.ref && byCode[refKey_(r.ref)]).length,
      competitionPeople: uniq(D.competitions).length, competitionEntries: entries, talent: uniq(D.talent).length, stalls: uniq(D.stall).length },
    crossover: { ambassadors: cross(D.ambassador), competitions: cross(D.competitions), talent: cross(D.talent), stalls: cross(D.stall) },
    competitions: Object.keys(compCount).map(n => ({ name: n, count: compCount[n] })),
    universities: Object.keys(uniCount).map(n => ({ name: n, count: uniCount[n] })).sort((a, b) => b.count - a.count).slice(0, 12),
    timeline, leaderboard, recent: recent.slice(0, 12), invalidRefs: invalid, announcements: readAnn_(),
  };
  try { cache.put("stats", JSON.stringify(out), CACHE_SECONDS); } catch (e) { /* too big to cache */ }
  return out;
}

/* -------------------- PORTAL -------------------- */
/* Sign-in. Ambassadors: reference number (or email) + the password we emailed them.
   Everyone else: email + last 4 digits of their phone number.
   Returns a signed token that the portal uses for 14 days. */
function login_(user, pass) {
  user = String(user || "").trim(); pass = String(pass || "").trim();
  if (!user || !pass) return { ok: false, message: "Enter your username and password." };
  const key = refKey_(user), em = user.toLowerCase();
  const amb = ambRows_().find(a => (key && /^[A-Z]*-?\d+$/i.test(user.replace(/\s/g, "")) && refKey_(a.code) === key) || a.email === em);
  if (amb && amb.pass && amb.pass === pass) return portalWithToken_(amb.email);
  if (/@/.test(em) && /^\d{4}$/.test(pass)) {
    const r = portal_(em, pass);
    return r.ok ? Object.assign(r, { token: token_(em) }) : r;
  }
  return { ok: false, message: amb ? "Wrong password. Check the email we sent you after you registered." : "We couldn't find that username. Ambassadors: use your reference number (e.g. NEA07). Others: use your email." };
}
function portalWithToken_(email) { const r = portalData_(email); return r.ok ? Object.assign(r, { token: token_(email) }) : r; }
function secret_() {
  const pr = PropertiesService.getScriptProperties();
  let s = pr.getProperty("TOKEN_SECRET");
  if (!s) { s = Utilities.getUuid() + Utilities.getUuid(); pr.setProperty("TOKEN_SECRET", s); }
  return s;
}
function sign_(txt) { return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(txt, secret_())).replace(/=+$/, ""); }
function token_(email) { const body = Utilities.base64EncodeWebSafe(email + "|" + (Date.now() + 14 * 864e5)).replace(/=+$/, ""); return body + "." + sign_(body); }
function fromToken_(t) {
  const [body, sig] = String(t || "").split(".");
  if (!body || sig !== sign_(body)) return "";
  const pad = body + "===".slice((body.length + 3) % 4);
  const [email, exp] = Utilities.newBlob(Utilities.base64DecodeWebSafe(pad)).getDataAsString().split("|");
  return Number(exp) > Date.now() ? email : "";
}
function portal_(email, phone4) {
  email = String(email || "").trim().toLowerCase(); phone4 = String(phone4 || "").replace(/\D/g, "");
  if (!email || phone4.length !== 4) return { ok: false, message: "Enter your email and the last 4 digits of your phone." };
  const mine = [].concat.apply([], Object.keys(TABS).map(k => readTab_(k).filter(r => r.email === email)));
  if (!mine.length) return { ok: false, message: "No registration found for this email. Use the email you entered in the form." };
  if (!mine.some(r => r.phone && r.phone.slice(-4) === phone4)) return { ok: false, message: "Those phone digits don't match our records." };
  return portalData_(email);
}
function portalData_(email) {
  const D = {}; Object.keys(TABS).forEach(k => (D[k] = readTab_(k).filter(r => r.email === email)));
  const mine = [].concat(D.main, D.ambassador, D.competitions, D.talent, D.stall);
  if (!mine.length) return { ok: false, message: "No registration found for this account." };
  const named = mine.find(r => r.name) || {}, unied = mine.find(r => r.uni) || {};
  let ambassador = null;
  if (D.ambassador.length && D.ambassador[0].code) {
    const s = stats_(), i = s.leaderboard.findIndex(a => a.code === D.ambassador[0].code), a = s.leaderboard[i];
    ambassador = { code: D.ambassador[0].code, rank: a && a.total > 0 ? i + 1 : null, of: s.leaderboard.length,
      referrals: a ? { main: a.main, competitions: a.competitions, talent: a.talent, total: a.total } : { main: 0, competitions: 0, talent: 0, total: 0 } };
  }
  const comps = []; D.competitions.forEach(r => compsOf_(r.comp).forEach(c => comps.indexOf(c) < 0 && comps.push(c)));
  const roles = {
    main: { registered: D.main.length > 0, ts: D.main[0] ? D.main[0].ts : null },
    ambassador, competitions: comps, talent: { applied: D.talent.length > 0 }, stall: D.stall.length ? { booked: true } : null,
  };
  const aud = ["all", "email:" + email];
  if (roles.main.registered) aud.push("attendees");
  if (ambassador) aud.push("ambassadors");
  if (comps.length || D.competitions.length) aud.push("competitors");
  if (roles.talent.applied) aud.push("talent");
  if (roles.stall) aud.push("exhibitors");
  return { ok: true, profile: { name: named.name, email, university: unied.uni }, roles, announcements: readAnn_().filter(a => aud.indexOf(a.audience) >= 0) };
}

/* -------------------- ANNOUNCEMENTS -------------------- */
function annSheet_() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(ANN_TAB);
  if (!sh) { sh = ss.insertSheet(ANN_TAB); sh.appendRow(["ID", "Timestamp", "Title", "Message", "Audience", "Link", "Pinned"]); }
  return sh;
}
function readAnn_() {
  const v = annSheet_().getDataRange().getValues().slice(1).filter(r => r[0]);
  return v.map(r => ({ id: String(r[0]), ts: r[1] instanceof Date ? r[1].toISOString() : r[1], title: r[2], message: r[3], audience: String(r[4] || "all"), link: r[5], pinned: r[6] === true || String(r[6]).toUpperCase() === "TRUE" }))
    .sort((a, b) => (b.pinned - a.pinned) || (new Date(b.ts) - new Date(a.ts)));
}

/* -------------------- HTTP endpoints -------------------- */
/* The dashboard stays locked until you replace the placeholder ADMIN_KEY */
function keyOk_(k) { return ADMIN_KEY !== "change-this-to-a-long-secret" && ADMIN_KEY.length >= 10 && String(k) === ADMIN_KEY; }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function doGet(e) {
  const p = (e && e.parameter) || {};
  try {
    if (p.action === "stats") { if (!keyOk_(p.key)) return json_({ error: "Invalid admin key" }); return json_(stats_()); }
    if (p.action === "portal") {
      if (p.token) { const em = fromToken_(p.token); return json_(em ? portalData_(em) : { ok: false, expired: true, message: "Please sign in again." }); }
      return json_(portal_(p.email, p.phone4));
    }
    if (p.action === "announcements") return json_({ announcements: readAnn_().filter(a => a.audience === "all") });
    return json_({ ok: true, service: "Nuqta-e-Aghaz API" });
  } catch (err) { return json_({ error: String(err) }); }
}

function doPost(e) {
  try {
    const p = JSON.parse(e.postData.contents || "{}");
    if (p.action === "login") return json_(login_(p.user, p.pass));
    if (!keyOk_(p.key)) return json_({ error: "Invalid admin key" });
    const sh = annSheet_();
    if (p.action === "announce") {
      if (!p.title || !p.message) return json_({ error: "Title and message are required" });
      sh.appendRow(["A" + Date.now(), new Date(), String(p.title).slice(0, 200), String(p.message).slice(0, 5000), p.audience || "all", p.link || "", !!p.pinned]);
    } else if (p.action === "deleteAnnouncement") {
      const ids = sh.getRange(1, 1, sh.getLastRow(), 1).getValues();
      for (let i = ids.length - 1; i >= 1; i--) if (String(ids[i][0]) === String(p.id)) sh.deleteRow(i + 1);
    } else return json_({ error: "Unknown action" });
    CacheService.getScriptCache().remove("stats");
    return json_({ ok: true, announcements: readAnn_() });
  } catch (err) { return json_({ error: String(err) }); }
}

/* -------------------- one-off: create Stall + Sponsor forms --------------------
   Run createStallAndSponsorForms once. It logs both form ids and links; put the ids in
   FORM_IDS (stall) and the links in config.js. Running it again makes new copies. */
function createStallAndSponsorForms() {
  const thanks = "Thank you! The Nuqta-e-Aghaz team will contact you on WhatsApp shortly.\nwww.nuqtaeaghaz.org";
  const stall = FormApp.create("Nuqta-e-Aghaz | Stall Booking")
    .setDescription("Book a stall at Nuqta-e-Aghaz 2026 — 05 December, Faletti's Hotel, Lahore. Booking deadline: 30 November.")
    .setConfirmationMessage(thanks).setCollectEmail(false).setAllowResponseEdits(false);
  stall.addTextItem().setTitle("Full Name").setRequired(true);
  stall.addTextItem().setTitle("Business / Brand Name").setRequired(true);
  stall.addTextItem().setTitle("WhatsApp Number").setRequired(true);
  stall.addTextItem().setTitle("Email").setRequired(true)
    .setValidation(FormApp.createTextValidation().requireTextIsEmail().build());
  stall.addMultipleChoiceItem().setTitle("What will you showcase?").setRequired(true)
    .setChoiceValues(["Food & Drinks", "Books & Stationery", "Tech & Gadgets", "Clothing & Accessories", "Startup / Services"]).showOtherOption(true);
  stall.addParagraphTextItem().setTitle("Anything else we should know?");

  const sp = FormApp.create("Nuqta-e-Aghaz | Sponsorship Enquiry")
    .setDescription("Partner with Nuqta-e-Aghaz 2026 and reach 2,000+ university students. Our team will share the full proposal and next steps.")
    .setConfirmationMessage(thanks).setCollectEmail(false).setAllowResponseEdits(false);
  sp.addTextItem().setTitle("Company / Organisation").setRequired(true);
  sp.addTextItem().setTitle("Contact Person (Full Name)").setRequired(true);
  sp.addTextItem().setTitle("WhatsApp Number").setRequired(true);
  sp.addTextItem().setTitle("Email").setRequired(true)
    .setValidation(FormApp.createTextValidation().requireTextIsEmail().build());
  sp.addMultipleChoiceItem().setTitle("Plan you're interested in").setRequired(true)
    .setChoiceValues(["Silver — PKR 100,000", "Gold — PKR 300,000", "Platinum — PKR 500,000", "Title Sponsorship — PKR 1,000,000", "Not sure yet / custom"]);
  sp.addParagraphTextItem().setTitle("Message");

  Logger.log("STALL id=" + stall.getId() + " url=" + stall.getPublishedUrl());
  Logger.log("SPONSOR id=" + sp.getId() + " url=" + sp.getPublishedUrl());
}
