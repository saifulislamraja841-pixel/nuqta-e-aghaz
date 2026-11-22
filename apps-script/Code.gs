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
const SEND_PARTICIPANT_EMAIL = true;                      // email new participants (main event, competitions, talent) their portal login
const SEND_AMBASSADOR_EMAIL = true;                       // email new ambassadors their reference number + portal login
const EMAIL_REPLIES = false;                              // messages and replies stay in the portal only (true = also email the reply)
/* WhatsApp alert to the official number for every new portal message (free CallMeBot API, see SETUP.md).
   Paste the API key here in the Apps Script editor only; do not commit it to GitHub. "" = alerts off. */
const WHATSAPP_ALERT_NUMBER = "923484243350";             // official number, international format, no +
const WHATSAPP_APIKEY = "";                               // the key CallMeBot sends to the official number

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
  annSheet_(); partSheet_(); msgSheet_(); logSheet_();
  syncAmbassadors_(false);                                  // number existing rows, no emails
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
  try { syncParticipants_(SEND_PARTICIPANT_EMAIL); } catch (e) { Logger.log("Participants: " + e); }
  try { continueReminders_(); } catch (e) { Logger.log("Reminders: " + e); }
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

/* -------------------- participant logins -------------------- */
/* "Participant Logins" tab in this spreadsheet: one row per email that registered for the
   main event, a competition or the Talent Award. Username = their email; the password is made
   automatically. New participants are emailed their login within 5 minutes.
   Write "skip" in Status to never email someone. Clear Login Sent to email them again. */
const PART_TAB = "Participant Logins";
const PART_FORMS = { main: "Main Event", competitions: "Competitions", talent: "Talent Award" };
const MAIL_RESERVE = 10;   // always keep this many of Gmail's daily emails for new ambassadors
function partSheet_() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(PART_TAB);
  if (!sh) { sh = ss.insertSheet(PART_TAB); sh.appendRow(["Email", "Name", "Registered for", "Portal Password", "Login Sent", "Status"]); sh.setFrozenRows(1); sh.getRange(1, 1, 1, 6).setFontWeight("bold"); }
  return sh;
}
function partRows_() {
  const v = partSheet_().getDataRange().getValues().slice(1);
  return v.filter(r => r[0]).map(r => ({ email: String(r[0]).trim().toLowerCase(), name: String(r[1] || ""), forms: String(r[2] || ""), pass: String(r[3] || "").trim(), status: String(r[5] || "").toLowerCase(), sent: r[4] || "" }));
}
/* Adds new participants, then emails anyone not yet emailed. Existing participants are only
   emailed after emailLoginsToExistingParticipants() has been run once. Returns emails sent. */
function syncParticipants_(sendEmail) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return 0;
  try {
    const pr = PropertiesService.getScriptProperties(), first = !pr.getProperty("PART_INIT");
    const backfill = pr.getProperty("PART_BACKFILL") === "on";
    const sh = partSheet_(), rows = sh.getDataRange().getValues().slice(1).map(r => { r = r.slice(0, 6); while (r.length < 6) r.push(""); return r; });
    const at = {}; rows.forEach((r, i) => (at[String(r[0]).trim().toLowerCase()] = i));
    const before = rows.length, edits = [], fresh = new Set();
    Object.keys(PART_FORMS).forEach(k => readTab_(k).forEach(r => {
      if (!r.email || r.email.indexOf("@") < 0) return;
      let i = at[r.email];
      if (i === undefined) {
        i = at[r.email] = rows.length; rows.push([r.email, r.name || "", PART_FORMS[k], newPassword_(), "", ""]);
        if (!first) fresh.add(i);
      } else {
        const f = String(rows[i][2] || "");
        if (f.split(", ").indexOf(PART_FORMS[k]) < 0) { rows[i][2] = f ? f + ", " + PART_FORMS[k] : PART_FORMS[k]; if (i < before) edits.push([i, 2]); }
        if (!rows[i][1] && r.name) { rows[i][1] = r.name; if (i < before) edits.push([i, 1]); }
        if (!String(rows[i][3]).trim()) { rows[i][3] = newPassword_(); if (i < before) edits.push([i, 3]); }
      }
    }));
    if (rows.length > before) sh.getRange(before + 2, 1, rows.length - before, 6).setValues(rows.slice(before));
    edits.forEach(([i, c]) => sh.getRange(i + 2, c + 1).setValue(rows[i][c]));
    if (first) pr.setProperty("PART_INIT", String(Date.now()));
    let sent = 0;
    if (sendEmail) rows.forEach((r, i) => {
      if (r[4] || /skip|stop/i.test(String(r[5])) || !(backfill || fresh.has(i))) return;
      if (MailApp.getRemainingDailyQuota() <= MAIL_RESERVE) return;
      if (sendParticipantEmail_(r[0], r[1], r[3], r[2])) { r[4] = new Date(); sh.getRange(i + 2, 5).setValue(r[4]); sent++; }
    });
    if (backfill && rows.every(r => r[4] || /skip|stop/i.test(String(r[5])))) pr.deleteProperty("PART_BACKFILL");
    return sent;
  } finally { lock.releaseLock(); }
}
/* Run this ONCE by hand to email every existing participant their login. Gmail allows about
   100 emails a day; whoever is left is emailed automatically over the next days. */
function emailLoginsToExistingParticipants() {
  PropertiesService.getScriptProperties().setProperty("PART_BACKFILL", "on");
  const n = syncParticipants_(true);
  const left = partSheet_().getDataRange().getValues().slice(1).filter(r => r[0] && !r[4] && !/skip|stop/i.test(String(r[5]))).length;
  Logger.log("Emails sent: " + n + ". Still to send: " + left + (left ? " (sent automatically when Gmail's daily limit resets)" : "") + ".");
}
function sendParticipantEmail_(to, name, pass, forms) {
  try {
    const portal = SITE_URL + "portal.html";
    MailApp.sendEmail({
      to: String(to).trim(),
      subject: "Your Nuqta-e-Aghaz Portal Login",
      htmlBody: "Assalam o Alaikum " + (name || "") + ",<br><br>Thank you for registering for Nuqta-e-Aghaz 2026" + (forms ? " (" + forms + ")" : "") + ". " +
        "Your personal portal shows what you've registered for, plus event updates and announcements from the team.<br><br>" +
        "<table style='border-collapse:collapse;font-size:15px'>" +
        "<tr><td style='padding:4px 14px 4px 0'>Username</td><td><b>" + to + "</b></td></tr>" +
        "<tr><td style='padding:4px 14px 4px 0'>Password</td><td><b style='font-family:monospace;font-size:16px'>" + pass + "</b></td></tr>" +
        "<tr><td style='padding:4px 14px 4px 0'>Sign in here</td><td><a href='" + portal + "'>" + portal + "</a></td></tr></table><br>" +
        "Please don't share your password.<br><br>— Team Nuqta-e-Aghaz",
    });
    return true;
  } catch (err) { Logger.log("Email failed: " + err); return false; }
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
  const c = { ref: f(/^reference number$/i), pass: f(/^portal password$/i), status: f(/^status$/i), email: f(/e-?mail/i), name: f(/^(full\s*)?name/i), sent: f(/^login sent$/i) };
  const v = (r, k) => c[k] >= 0 ? String(r[c[k]] == null ? "" : r[c[k]]).trim() : "";
  return all.slice(1).map(r => ({ email: v(r, "email").toLowerCase(), name: v(r, "name"), code: v(r, "ref"), pass: v(r, "pass"), status: v(r, "status").toLowerCase(),
      sent: c.sent >= 0 ? r[c.sent] : "" }))
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
  const r = checkLogin_(user, pass);
  if (r.ok && r.profile) { logActivity_(r.profile.email, "login"); const a = findAccount_(r.profile.email); r.username = (a && a.code) || r.profile.email; }
  return r;
}
function checkLogin_(user, pass) {
  user = String(user || "").trim(); pass = String(pass || "").trim();
  if (!user || !pass) return { ok: false, message: "Enter your username and password." };
  const key = refKey_(user), em = user.toLowerCase();
  const amb = ambRows_().find(a => (key && /^[A-Z]*-?\d+$/i.test(user.replace(/\s/g, "")) && refKey_(a.code) === key) || a.email === em);
  if (amb && amb.pass && amb.pass === pass) return portalWithToken_(amb.email);
  const part = /@/.test(em) && partRows_().find(p => p.email === em);
  if (part && part.pass && part.pass === pass) return portalWithToken_(part.email);
  if (/@/.test(em) && /^\d{4}$/.test(pass)) {
    const r = portal_(em, pass);
    return r.ok ? Object.assign(r, { token: token_(em) }) : r;
  }
  return { ok: false, message: amb || part ? "Wrong password. Check the email we sent you after you registered." : "We couldn't find that username. Ambassadors: use your reference number (e.g. NEA07). Others: use your email." };
}
/* -------------------- PASSWORDS: reset + change -------------------- */
/* Forgot password: we email a 6-digit code (valid 15 minutes) to the account's email; with the code
   they choose a new password. Signed-in people can also change their password in the portal.
   The new password is written to the same "Portal Password" column the login uses. */
function findAccount_(user) {
  user = String(user || "").trim();
  const key = refKey_(user), em = user.toLowerCase();
  const amb = ambRows_().find(a => (key && /^[A-Z]*-?\d+$/i.test(user.replace(/\s/g, "")) && refKey_(a.code) === key) || a.email === em);
  if (amb) return { email: amb.email, name: amb.name, code: amb.code };
  const part = /@/.test(em) && partRows_().find(p => p.email === em && !/skip|stop/.test(p.status));
  return part ? { email: part.email, name: part.name, code: "" } : null;
}
function checkNewPassword_(pass) {
  pass = String(pass || "");
  if (pass.length < 6) return "Use at least 6 characters for your password.";
  if (pass.length > 64) return "Please keep your password under 64 characters.";
  if (/^\s|\s$/.test(pass)) return "Your password can't start or end with a space.";
  return "";
}
function setPassword_(email, pass) {
  email = String(email || "").toLowerCase();
  let n = 0;
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    // ambassadors: every numbered row with this email
    const sh = ambSheet_(), all = sh.getDataRange().getValues(), H = all[0].map(h => String(h).trim()), f = re => H.findIndex(h => re.test(h));
    const c = { email: f(/e-?mail/i), pass: f(/^portal password$/i), ref: f(/^reference number$/i), status: f(/^status$/i) };
    if (c.email >= 0 && c.pass >= 0) all.slice(1).forEach((r, i) => {
      if (String(r[c.email]).trim().toLowerCase() !== email || (c.ref >= 0 && !String(r[c.ref]).trim())) return;
      if (c.status >= 0 && /reject|duplicate/i.test(String(r[c.status]))) return;
      sh.getRange(i + 2, c.pass + 1).setNumberFormat("@").setValue(pass); n++;
    });
    // participants
    const ps = partSheet_(), rows = ps.getDataRange().getValues();
    rows.slice(1).forEach((r, i) => { if (String(r[0]).trim().toLowerCase() === email) { ps.getRange(i + 2, 4).setNumberFormat("@").setValue(pass); n++; } });
  } finally { lock.releaseLock(); }
  return n;
}
const mask_ = em => String(em).replace(/^(.{1,2})[^@]*(@.*)$/, (m, a, b) => a + "•••" + b);
function resetRequest_(user) {
  const acct = findAccount_(user);
  if (!acct) return { ok: false, message: "We couldn't find that username. Ambassadors: use your reference number (e.g. NEA07). Others: use your registered email." };
  const cache = CacheService.getScriptCache(), rk = "resetn_" + acct.email, n = Number(cache.get(rk) || 0);
  if (n >= 3) return { ok: false, message: "We've already sent you several codes. Please check your email (and the Spam folder) or try again in an hour." };
  if (MailApp.getRemainingDailyQuota() < 1) return { ok: false, message: "We can't send emails right now. Please try again tomorrow or message us on WhatsApp." };
  const code = String(Math.floor(100000 + Math.random() * 900000));
  cache.put("reset_" + acct.email, JSON.stringify({ code, tries: 0 }), 900);
  cache.put(rk, String(n + 1), 3600);
  MailApp.sendEmail({ to: acct.email, subject: "Your Nuqta-e-Aghaz password reset code: " + code, name: "Nuqta-e-Aghaz",
    htmlBody: "Assalam o Alaikum " + String(acct.name || "").replace(/</g, "&lt;") + ",<br><br>Your code to reset your portal password is:<br><br>" +
      "<b style='font-size:26px;letter-spacing:4px'>" + code + "</b><br><br>It works for 15 minutes. If you didn't ask for this, ignore this email; your password stays the same." +
      "<br><br>Portal: <a href='" + SITE_URL + "portal.html'>" + SITE_URL + "portal.html</a><br><br>— Team Nuqta-e-Aghaz" });
  return { ok: true, sentTo: mask_(acct.email) };
}
function resetConfirm_(user, code, pass) {
  const acct = findAccount_(user);
  if (!acct) return { ok: false, message: "We couldn't find that username." };
  const cache = CacheService.getScriptCache(), k = "reset_" + acct.email, saved = JSON.parse(cache.get(k) || "null");
  if (!saved) return { ok: false, message: "This code has expired. Ask for a new code." };
  if (String(code || "").replace(/\D/g, "") !== saved.code) {
    saved.tries++;
    if (saved.tries >= 5) { cache.remove(k); return { ok: false, message: "Too many wrong codes. Ask for a new code." }; }
    cache.put(k, JSON.stringify(saved), 900);
    return { ok: false, message: "That code is not correct. Check the latest email from us." };
  }
  const bad = checkNewPassword_(pass);
  if (bad) return { ok: false, message: bad };
  if (!setPassword_(acct.email, String(pass))) return { ok: false, message: "We couldn't update your password. Please message us on WhatsApp." };
  cache.remove(k); cache.remove("resetn_" + acct.email);
  logActivity_(acct.email, "login");
  return Object.assign(portalWithToken_(acct.email), { username: acct.code || acct.email });
}
function changePassword_(token, pass) {
  const email = fromToken_(token);
  if (!email) return { ok: false, expired: true, message: "Please sign in again." };
  const bad = checkNewPassword_(pass);
  if (bad) return { ok: false, message: bad };
  const acct = findAccount_(email) || {};
  if (!setPassword_(email, String(pass))) return { ok: false, message: "We couldn't update your password. Please message us on WhatsApp." };
  return { ok: true, username: acct.code || email };
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
  return { ok: true, profile: { name: named.name, email, university: unied.uni }, roles, announcements: readAnn_().filter(a => aud.indexOf(a.audience) >= 0),
    messages: readMessages_().filter(m => m.email === email) };
}

/* -------------------- PORTAL ACTIVITY (who logs in) -------------------- */
/* "Portal Activity" tab: one row each time someone signs in ("login") or comes back to the
   portal while still signed in ("visit", counted at most once every 30 minutes per person). */
const LOG_TAB = "Portal Activity";
function logSheet_() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(LOG_TAB);
  if (!sh) { sh = ss.insertSheet(LOG_TAB); sh.appendRow(["Timestamp", "Email", "Event"]); sh.setFrozenRows(1); sh.getRange(1, 1, 1, 3).setFontWeight("bold"); }
  return sh;
}
function logActivity_(email, event) {
  email = String(email || "").trim().toLowerCase();
  if (!email) return;
  const cache = CacheService.getScriptCache(), k = "seen_" + email;
  if (event === "visit" && cache.get(k)) return;
  cache.put(k, "1", 1800);
  try { logSheet_().appendRow([new Date(), email, event]); cache.remove("activity"); } catch (e) { Logger.log("Activity log: " + e); }
}
/* Everyone who has a portal account (ambassadors + participants), with their login history */
function activity_() {
  const cache = CacheService.getScriptCache(), hit = cache.get("activity");
  if (hit) return JSON.parse(hit);
  const people = {};
  const add = (email, name, type, extra) => {
    if (!email) return;
    const p = people[email] || (people[email] = { email, name: "", types: [], code: "", forms: "", firstSeen: null, lastSeen: null, logins: 0, visits: 0, days: {}, activated: false, activatedAt: null });
    if (!p.name && name) p.name = name;
    if (p.types.indexOf(type) < 0) p.types.push(type);
    const x = Object.assign({}, extra || {}), sent = x.sent; delete x.sent;
    Object.assign(p, x);
    // "Activated" = a portal password exists and the login details were emailed (Login Sent has a date)
    if (sent) { p.activated = true; p.emailSent = true; if (sent instanceof Date && (!p.activatedAt || sent < p.activatedAt)) p.activatedAt = sent; }
  };
  ambRows_().forEach(a => add(a.email, a.name, "Ambassador", { code: a.code, sent: a.pass && a.sent }));
  partRows_().filter(p => !/skip|stop/.test(p.status)).forEach(p => add(p.email, p.name, "Participant", { forms: p.forms, sent: p.pass && p.sent }));
  const accounts = Object.keys(people).length;
  const log = logSheet_().getDataRange().getValues().slice(1).filter(r => r[1] && r[0] instanceof Date);
  log.forEach(r => {
    const em = String(r[1]).trim().toLowerCase(), t = r[0];
    if (!people[em]) add(em, "", "Other");
    const p = people[em];
    if (!p.firstSeen || t < p.firstSeen) p.firstSeen = t;
    if (!p.lastSeen || t > p.lastSeen) p.lastSeen = t;
    if (String(r[2]) === "login") p.logins++; else p.visits++;
    p.days[dayKey_(t)] = 1;
  });
  const rem = reminded_();
  const now = Date.now(), list = Object.keys(people).map(k => people[k]);
  const since = ms => list.filter(p => p.lastSeen && now - p.lastSeen.getTime() <= ms).length;
  const group = type => { const g = list.filter(p => p.types.indexOf(type) >= 0); return { total: g.length, loggedIn: g.filter(p => p.lastSeen).length }; };
  const daily = [];
  for (let i = 13; i >= 0; i--) {
    const k = dayKey_(new Date(now - i * 864e5));
    daily.push({ date: k, people: list.filter(p => p.days[k]).length, logins: log.filter(r => String(r[2]) === "login" && dayKey_(r[0]) === k).length });
  }
  const out = {
    generatedAt: new Date().toISOString(),
    totals: { accounts, activated: list.filter(p => p.activated || p.logins > 0).length, loggedIn: list.filter(p => p.lastSeen).length, never: list.filter(p => !p.lastSeen).length,
      active24h: since(864e5), active7d: since(7 * 864e5), logins: log.filter(r => String(r[2]) === "login").length },
    groups: { ambassadors: group("Ambassador"), participants: group("Participant") },
    mail: { quota: MailApp.getRemainingDailyQuota(), autoAmbassadors: SEND_AMBASSADOR_EMAIL, autoParticipants: SEND_PARTICIPANT_EMAIL },
    reminderRound: PropertiesService.getScriptProperties().getProperty("REMIND_ROUND") ? { group: PropertiesService.getScriptProperties().getProperty("REMIND_GROUP") || "all" } : null,
    daily,
    people: list.map(p => ({ email: p.email, name: p.name, type: p.types.join(" + "), code: p.code, forms: p.forms,
      firstSeen: p.firstSeen ? p.firstSeen.toISOString() : "", lastSeen: p.lastSeen ? p.lastSeen.toISOString() : "",
      logins: p.logins, visits: p.visits, daysActive: Object.keys(p.days).length,
      activated: p.activated || p.logins > 0, activatedAt: p.activatedAt ? p.activatedAt.toISOString() : "",
      reminded: rem[p.email] && rem[p.email].last ? new Date(rem[p.email].last).toISOString() : "", reminders: rem[p.email] ? rem[p.email].n : 0,
      remindedVia: rem[p.email] ? rem[p.email].via : "", emailSent: !!p.emailSent }))
      .sort((a, b) => (b.lastSeen || "").localeCompare(a.lastSeen || "") || a.name.localeCompare(b.name)),
  };
  try { cache.put("activity", JSON.stringify(out), 120); } catch (e) { /* too big to cache */ }
  return out;
}

/* -------------------- LOGIN REMINDERS (people who never signed in) -------------------- */
/* "Send reminder" in Dashboard → Portal activity emails everyone who has never signed in their
   username, password and the portal link. Gmail allows about 100 emails a day, so whoever is left
   gets theirs automatically over the next days (refreshAll continues the round every 5 minutes).
   Nobody gets more than one reminder per round, and never two within 3 days.
   The "Login Reminders" tab records who was reminded and when. */
const REM_TAB = "Login Reminders";
function remSheet_() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(REM_TAB);
  if (!sh) { sh = ss.insertSheet(REM_TAB); sh.appendRow(["Email", "Name", "Last Reminder", "Reminders", "Sent By"]); sh.setFrozenRows(1); sh.getRange(1, 1, 1, 5).setFontWeight("bold"); }
  else if (sh.getLastColumn() < 5) sh.getRange(1, 5).setValue("Sent By").setFontWeight("bold");
  return sh;
}
function reminded_() {
  const m = {};
  remSheet_().getDataRange().getValues().slice(1).forEach((r, i) => { if (r[0]) m[String(r[0]).trim().toLowerCase()] = { row: i + 2, last: r[2] instanceof Date ? r[2].getTime() : 0, n: Number(r[3]) || 0, via: String(r[4] || "Email") }; });
  return m;
}
/* Records that someone was reminded (via "Email", "Portal" or "Email + Portal") */
function noteReminder_(sh, done, p, via) {
  const d = done[p.email], now = new Date();
  if (d) { sh.getRange(d.row, 2, 1, 4).setValues([[p.name || "", now, d.n + 1, via]]); d.last = now.getTime(); d.n++; d.via = via; }
  else { sh.appendRow([p.email, p.name || "", now, 1, via]); done[p.email] = { row: sh.getLastRow(), last: now.getTime(), n: 1, via }; }
}
/* A personal notice in that person's portal (shows under "Announcements for you") */
function portalReminder_(p) {
  annSheet_().appendRow(["A" + Date.now() + Math.floor(Math.random() * 1000), new Date(), "Your portal is ready, please sign in",
    "Assalam o Alaikum " + (p.name || "") + "! Your Nuqta-e-Aghaz portal has your registrations, event updates" + (p.code ? ", your ambassador link and referral count" : "") +
    ". Sign in with username " + p.user + " and the password we emailed you. Forgot it? Tap \"Forgot your password?\" on the sign-in page.", "email:" + p.email, SITE_URL + "portal.html", false]);
}
/* Every portal account: { email, name, user, pass, code, forms, kind: "amb" | "part" } */
function allAccounts_() {
  const out = {};
  ambRows_().forEach(a => { if (!out[a.email]) out[a.email] = { email: a.email, name: a.name, user: a.code, code: a.code, pass: a.pass, kind: "amb" }; });
  partRows_().forEach(p => { if (!out[p.email] && !/skip|stop/.test(p.status)) out[p.email] = { email: p.email, name: p.name, user: p.email, code: "", pass: p.pass, forms: p.forms, kind: "part" }; });
  return out;
}
/* Marks the login email as sent in the sheet the login comes from */
function markLoginSent_(email) {
  const now = new Date();
  const sh = ambSheet_(), all = sh.getDataRange().getValues(), H = all[0].map(h => String(h).trim()), f = re => H.findIndex(h => re.test(h));
  const c = { email: f(/e-?mail/i), sent: f(/^login sent$/i), ref: f(/^reference number$/i) };
  if (c.email >= 0 && c.sent >= 0) all.slice(1).forEach((r, i) => {
    if (String(r[c.email]).trim().toLowerCase() === email && (c.ref < 0 || String(r[c.ref]).trim())) sh.getRange(i + 2, c.sent + 1).setValue(now);
  });
  const ps = partSheet_();
  ps.getDataRange().getValues().slice(1).forEach((r, i) => { if (String(r[0]).trim().toLowerCase() === email) ps.getRange(i + 2, 5).setValue(now); });
}
/* Dashboard: send (or re-send) the login email to the chosen people now */
function sendLoginNow_(emails) {
  const acc = allAccounts_(), lock = LockService.getScriptLock(); lock.waitLock(20000);
  let sent = 0, failed = 0, noQuota = 0;
  try {
    (emails || []).map(e => String(e).trim().toLowerCase()).forEach(e => {
      const a = acc[e]; if (!a || !a.pass) { failed++; return; }
      if (MailApp.getRemainingDailyQuota() < 1) { noQuota++; return; }
      const ok = a.kind === "amb" ? sendLoginEmail_(a.email, a.name, a.code, a.pass, false) : sendParticipantEmail_(a.email, a.name, a.pass, a.forms);
      if (ok) { markLoginSent_(a.email); sent++; } else failed++;
    });
  } finally { lock.releaseLock(); }
  CacheService.getScriptCache().remove("activity");
  return { ok: true, sent, failed, noQuota, quota: MailApp.getRemainingDailyQuota() };
}
/* Dashboard: remind the chosen people now, by "email", "portal" or "both" */
function remindPeople_(emails, channel) {
  channel = ["email", "portal", "both"].indexOf(channel) >= 0 ? channel : "email";
  const acc = allAccounts_(), sh = remSheet_(), done = reminded_();
  let emailed = 0, posted = 0, failed = 0, noQuota = 0;
  (emails || []).map(e => String(e).trim().toLowerCase()).forEach(e => {
    const a = acc[e]; if (!a) { failed++; return; }
    let via = [];
    if (channel !== "email") { portalReminder_(a); posted++; via.push("Portal"); }
    if (channel !== "portal") {
      if (MailApp.getRemainingDailyQuota() <= 0) noQuota++;
      else if (a.pass && sendReminderEmail_(a)) { emailed++; via.unshift("Email"); }
      else failed++;
    }
    if (via.length) noteReminder_(sh, done, a, via.join(" + "));
  });
  CacheService.getScriptCache().remove("activity");
  return { ok: true, emailed, posted, failed, noQuota, quota: MailApp.getRemainingDailyQuota() };
}
/* Everyone with a password who has never signed in: [{ email, name, user, pass, group }] */
function neverLoggedIn_(group) {
  const seen = {};
  logSheet_().getDataRange().getValues().slice(1).forEach(r => { if (r[1]) seen[String(r[1]).trim().toLowerCase()] = 1; });
  const out = {}, want = g => !group || group === "all" || group === g;
  if (want("Ambassador")) ambRows_().forEach(a => { if (a.pass && !seen[a.email] && !out[a.email]) out[a.email] = { email: a.email, name: a.name, user: a.code, code: a.code, pass: a.pass }; });
  if (want("Participant")) partRows_().forEach(p => { if (p.pass && !seen[p.email] && !out[p.email] && !/skip|stop/.test(p.status)) out[p.email] = { email: p.email, name: p.name, user: p.email, pass: p.pass }; });
  return Object.keys(out).map(k => out[k]);
}
function sendReminderEmail_(p) {
  try {
    const portal = SITE_URL + "portal.html", app = SITE_URL + "install.html";
    MailApp.sendEmail({
      to: p.email, name: "Nuqta-e-Aghaz",
      subject: "Reminder: your Nuqta-e-Aghaz portal is waiting for you",
      htmlBody: "Assalam o Alaikum " + String(p.name || "").replace(/</g, "&lt;") + ",<br><br>You haven't signed in to your Nuqta-e-Aghaz portal yet. " +
        "It has your registrations, event updates, announcements" + (/^[A-Z]/i.test(p.user) && !/@/.test(p.user) ? ", your ambassador link and referral count" : "") +
        ", and you can message the team there (text, photo or voice note).<br><br>" +
        "<table style='border-collapse:collapse;font-size:15px'>" +
        "<tr><td style='padding:4px 14px 4px 0'>Username</td><td><b>" + p.user + "</b></td></tr>" +
        "<tr><td style='padding:4px 14px 4px 0'>Password</td><td><b style='font-family:monospace;font-size:16px'>" + String(p.pass).replace(/</g, "&lt;") + "</b></td></tr>" +
        "<tr><td style='padding:4px 14px 4px 0'>Sign in here</td><td><a href='" + portal + "'>" + portal + "</a></td></tr></table><br>" +
        "Forgot your password? Tap <b>Forgot your password?</b> on the sign-in page to set a new one.<br>" +
        "Get the app on your phone: <a href='" + app + "'>" + app + "</a><br><br>— Team Nuqta-e-Aghaz",
    });
    return true;
  } catch (e) { Logger.log("Reminder failed for " + p.email + ": " + e); return false; }
}
/* Sends reminders for the current round, as far as today's Gmail quota allows. */
function runReminders_(group) {
  const pr = PropertiesService.getScriptProperties(), round = Number(pr.getProperty("REMIND_ROUND") || 0);
  group = group || pr.getProperty("REMIND_GROUP") || "all";
  if (!round) return { sent: 0, left: 0 };
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return { sent: 0, left: -1 };
  try {
    const sh = remSheet_(), done = reminded_(), now = Date.now();
    // a portal-only notice doesn't count: those people still get the email
    const todo = neverLoggedIn_(group).filter(p => { const d = done[p.email]; return !d || d.via === "Portal" || (d.last < round && now - d.last > 3 * 864e5); });
    let sent = 0;
    for (const p of todo) {
      if (MailApp.getRemainingDailyQuota() <= MAIL_RESERVE) break;
      if (!sendReminderEmail_(p)) continue;
      const d = done[p.email];
      noteReminder_(sh, done, p, d && d.via === "Portal" && now - d.last < 864e5 ? "Email + Portal" : "Email");
      sent++;
    }
    const left = todo.length - sent;
    if (!left) { pr.deleteProperty("REMIND_ROUND"); pr.deleteProperty("REMIND_GROUP"); }
    CacheService.getScriptCache().remove("activity");
    return { sent, left };
  } finally { lock.releaseLock(); }
}
function continueReminders_() { if (PropertiesService.getScriptProperties().getProperty("REMIND_ROUND")) runReminders_(); }
/* From the dashboard: start a new round (or carry on the current one) */
function startReminders_(group, channel) {
  const pr = PropertiesService.getScriptProperties();
  let posted = 0;
  if (channel === "portal" || channel === "both") {        // portal notices: everyone at once, no Gmail limit
    const sh = remSheet_(), done = reminded_();
    neverLoggedIn_(group).forEach(p => {
      const d = done[p.email]; if (d && /Portal/.test(d.via) && Date.now() - d.last < 864e5) return;   // already got a portal notice today
      portalReminder_(p); noteReminder_(sh, done, p, "Portal"); posted++;
    });
    if (channel === "portal") { CacheService.getScriptCache().remove("activity"); return { ok: true, sent: 0, posted, left: 0, quota: MailApp.getRemainingDailyQuota() }; }
  }
  if (!pr.getProperty("REMIND_ROUND")) { pr.setProperty("REMIND_ROUND", String(Date.now())); pr.setProperty("REMIND_GROUP", group || "all"); }
  const r = runReminders_();
  return { ok: true, sent: r.sent, posted, left: Math.max(0, r.left), quota: MailApp.getRemainingDailyQuota() };
}
/* Can also be run by hand from the editor */
function sendLoginReminders() { Logger.log(JSON.stringify(startReminders_("all"))); }

/* -------------------- MESSAGES (portal → team) -------------------- */
/* "Messages" tab: questions people send from their portal. Reply from the dashboard inbox
   (or type in the Reply column); the reply shows in their portal. Status: Open / Answered / Closed. */
const MSG_TAB = "Messages";
const MSG_HEAD = ["ID", "Timestamp", "Email", "Name", "Topic", "Message", "Status", "Reply", "Replied At", "Attachment", "Reply Attachment"];
function msgSheet_() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(MSG_TAB);
  if (!sh) { sh = ss.insertSheet(MSG_TAB); sh.appendRow(MSG_HEAD); sh.setFrozenRows(1); sh.getRange(1, 1, 1, MSG_HEAD.length).setFontWeight("bold"); }
  else if (sh.getLastColumn() < MSG_HEAD.length) sh.getRange(1, 1, 1, MSG_HEAD.length).setValues([MSG_HEAD]).setFontWeight("bold");
  return sh;
}

/* -------------------- ATTACHMENTS (photos + voice notes in messages) -------------------- */
/* Files are saved privately in the Drive folder "Nuqta Portal Attachments" of the account that runs
   this script. They are never shared publicly: the portal and dashboard fetch them through this
   script, and only the person in that conversation (or the team, with the admin key) can open them. */
const ATTACH_FOLDER = "Nuqta Portal Attachments";
const ATTACH_MAX_BYTES = 6 * 1024 * 1024;
function attachFolder_() {
  const pr = PropertiesService.getScriptProperties(), id = pr.getProperty("ATTACH_FOLDER_ID");
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { /* deleted: make a new one */ } }
  const f = DriveApp.createFolder(ATTACH_FOLDER);
  pr.setProperty("ATTACH_FOLDER_ID", f.getId());
  return f;
}
/* Run this once from the editor: it asks Google for permission to save files in Drive. */
function authorizeAttachments() { Logger.log("Attachments folder: " + attachFolder_().getUrl()); }
/* Documents that can be attached, by extension */
const DOC_TYPES = { pdf: "application/pdf", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain", csv: "text/csv", zip: "application/zip", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
/* a = { kind: "image" | "voice" | "file", mime, name, data (base64), duration }. Returns the stored description or throws. */
function saveAttachment_(a, who) {
  if (!a || !a.data) return null;
  const kind = a.kind === "voice" ? "voice" : a.kind === "file" ? "file" : "image";
  let mime = String(a.mime || "").split(";")[0].toLowerCase();
  if (kind === "image" && !/^image\/(jpeg|png|webp|gif)$/.test(mime)) throw new Error("Only photos (JPG, PNG, WEBP) can be sent.");
  if (kind === "voice" && !/^audio\/(webm|mp4|mpeg|ogg|aac|x-m4a|wav)$/.test(mime)) throw new Error("This voice note format isn't supported.");
  const bytes = Utilities.base64Decode(String(a.data).replace(/^data:[^,]*,/, ""));
  if (bytes.length > ATTACH_MAX_BYTES) throw new Error("The file is too large (6 MB at most).");
  if (kind === "file") {                               // documents keep their own (cleaned-up) name
    const orig = String(a.name || "file").replace(/[\\/:*?"<>|\x00-\x1f]+/g, "_").replace(/^\.+/, "").slice(-120) || "file";
    const ext = ((orig.match(/\.([a-z0-9]+)$/i) || [])[1] || "").toLowerCase();
    if (!DOC_TYPES[ext]) throw new Error("You can attach PDF, Word, Excel, PowerPoint, text, CSV, ZIP or image files.");
    mime = DOC_TYPES[ext];
    const stamp = Utilities.formatDate(new Date(), "Asia/Karachi", "yyyyMMdd-HHmmss");
    const f = attachFolder_().createFile(Utilities.newBlob(bytes, mime, stamp + "_" + String(who || "").replace(/[^a-z0-9]+/gi, "-").slice(0, 40) + "_" + orig));
    return { id: f.getId(), kind, mime, size: bytes.length, name: orig };
  }
  const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "audio/webm": "webm", "audio/mp4": "m4a", "audio/x-m4a": "m4a",
    "audio/mpeg": "mp3", "audio/ogg": "ogg", "audio/aac": "aac", "audio/wav": "wav" }[mime] || "bin";
  const name = (kind === "voice" ? "voice" : "photo") + "_" + String(who || "").replace(/[^a-z0-9]+/gi, "-").slice(0, 40) + "_" +
    Utilities.formatDate(new Date(), "Asia/Karachi", "yyyyMMdd-HHmmss") + "." + ext;
  const file = attachFolder_().createFile(Utilities.newBlob(bytes, mime, name));
  return { id: file.getId(), kind, mime, size: bytes.length, duration: Math.max(0, Math.round(Number(a.duration) || 0)) };
}
function parseAtt_(v) { try { const o = v ? JSON.parse(String(v)) : null; return o && o.id ? o : null; } catch (e) { return null; } }
/* Sends one attachment back as base64, only to someone allowed to see it */
function getAttachment_(id, token, key) {
  id = String(id || "");
  const admin = key && keyOk_(key), email = admin ? "" : fromToken_(token);
  if (!admin && !email) return { ok: false, expired: !!token, message: "Please sign in again." };
  const m = readMessages_().find(x => (x.attachment && x.attachment.id === id) || (x.replyAttachment && x.replyAttachment.id === id));
  if (!m || (!admin && m.email !== email)) return { ok: false, message: "File not found." };
  const blob = DriveApp.getFileById(id).getBlob(), att = (m.attachment && m.attachment.id === id) ? m.attachment : m.replyAttachment;
  return { ok: true, mime: (att && att.mime) || blob.getContentType(), name: (att && att.name) || "", data: Utilities.base64Encode(blob.getBytes()) };
}
function readMessages_() {
  const iso = v => v instanceof Date ? v.toISOString() : String(v || "");
  return msgSheet_().getDataRange().getValues().slice(1).filter(r => r[0]).map(r => ({
    id: String(r[0]), ts: iso(r[1]), email: String(r[2]).trim().toLowerCase(), name: String(r[3] || ""), topic: String(r[4] || ""),
    message: String(r[5] || ""), status: String(r[6] || "Open"), reply: String(r[7] || ""), repliedAt: iso(r[8]),
    attachment: parseAtt_(r[9]), replyAttachment: parseAtt_(r[10]),
  })).sort((a, b) => new Date(b.ts) - new Date(a.ts));
}
function sendMessage_(token, topic, message, attachment) {
  const email = fromToken_(token);
  if (!email) return { ok: false, expired: true, message: "Please sign in again." };
  message = String(message || "").trim(); topic = String(topic || "General question").trim().slice(0, 60);
  const hasFile = !!(attachment && attachment.data);
  if (!hasFile && message.length < 3) return { ok: false, message: "Please write your message, or add a photo, voice note or file." };
  if (message.length > 2000) return { ok: false, message: "Please keep your message under 2,000 characters." };
  const cache = CacheService.getScriptCache(), rk = "msgs_" + email, n = Number(cache.get(rk) || 0);
  if (n >= 5) return { ok: false, message: "You've sent several messages in the last hour. Please wait for our reply." };
  cache.put(rk, String(n + 1), 3600);
  const acct = ambRows_().find(a => a.email === email) || partRows_().find(p => p.email === email) || {};
  let att = null;
  try { att = hasFile ? saveAttachment_(attachment, acct.code || email) : null; } catch (e) { cache.put(rk, String(n), 3600); return { ok: false, message: e.message }; }
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try { msgSheet_().appendRow(["M" + Date.now(), new Date(), email, acct.name || "", topic, message, "Open", "", "", att ? JSON.stringify(att) : "", ""]); }
  finally { lock.releaseLock(); }
  const extra = att ? (att.kind === "voice" ? "🎤 Voice note" + (att.duration ? " (" + att.duration + "s)" : "") : att.kind === "file" ? "📎 File: " + att.name : "📷 Photo") + " attached" : "";
  whatsAppAlert_("📩 New portal message — Nuqta-e-Aghaz\n" + (acct.name || email) + (acct.code ? " (" + acct.code + ")" : "") +
    "\nTopic: " + topic + "\n\n" + message.slice(0, 600) + (message.length > 600 ? "…" : "") + (extra ? (message ? "\n" : "") + extra : "") + "\n\nReply: " + SITE_URL + "dashboard.html");
  return { ok: true, messages: readMessages_().filter(m => m.email === email) };
}
/* Sends a WhatsApp message to the official number. Never stops the portal if it fails. */
function whatsAppAlert_(text) {
  if (!WHATSAPP_APIKEY || !WHATSAPP_ALERT_NUMBER) return false;
  try {
    const url = "https://api.callmebot.com/whatsapp.php?phone=" + encodeURIComponent(WHATSAPP_ALERT_NUMBER) +
      "&apikey=" + encodeURIComponent(WHATSAPP_APIKEY) + "&text=" + encodeURIComponent(text);
    const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) Logger.log("WhatsApp alert failed: " + res.getResponseCode() + " " + res.getContentText().slice(0, 300));
    return res.getResponseCode() === 200;
  } catch (e) { Logger.log("WhatsApp alert failed: " + e); return false; }
}
/* Run this once from the editor after adding the API key: a test message should arrive on the official number. */
function testWhatsAppAlert() {
  Logger.log(whatsAppAlert_("✅ Nuqta-e-Aghaz portal alerts are working. New portal messages will arrive here.") ? "Sent" : "Not sent: check WHATSAPP_APIKEY and the log above");
}
function msgRow_(id) {
  const sh = msgSheet_(), ids = sh.getRange(1, 1, sh.getLastRow(), 1).getValues();
  for (let i = 1; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 1;
  return 0;
}
function replyMessage_(id, reply, attachment) {
  reply = String(reply || "").trim();
  const hasFile = !!(attachment && attachment.data);
  if (!reply && !hasFile) return { error: "Write a reply, or add a photo or voice note" };
  const row = msgRow_(id);
  if (!row) return { error: "Message not found" };
  const sh = msgSheet_(), r = sh.getRange(row, 1, 1, MSG_HEAD.length).getValues()[0];
  let att = null;
  try { att = hasFile ? saveAttachment_(attachment, "team") : null; } catch (e) { return { error: e.message }; }
  sh.getRange(row, 7, 1, 3).setValues([["Answered", reply.slice(0, 5000), new Date()]]);
  sh.getRange(row, 11).setValue(att ? JSON.stringify(att) : "");
  if (EMAIL_REPLIES && r[2] && MailApp.getRemainingDailyQuota() > MAIL_RESERVE) {
    try {
      MailApp.sendEmail({ to: String(r[2]), subject: "Reply from Team Nuqta-e-Aghaz: " + r[4],
        htmlBody: "Assalam o Alaikum " + (r[3] || "") + ",<br><br>" + reply.replace(/</g, "&lt;").replace(/\n/g, "<br>") +
          "<br><br><span style='color:#777'>Your message: " + String(r[5]).replace(/</g, "&lt;") + "</span><br><br>" +
          "See all your messages in your portal: <a href='" + SITE_URL + "portal.html'>" + SITE_URL + "portal.html</a><br><br>— Team Nuqta-e-Aghaz" });
    } catch (e) { Logger.log("Reply email failed: " + e); }
  }
  return { ok: true };
}
function setMessageStatus_(id, status) {
  if (["Open", "Answered", "Closed"].indexOf(status) < 0) return { error: "Unknown status" };
  const row = msgRow_(id);
  if (!row) return { error: "Message not found" };
  msgSheet_().getRange(row, 7).setValue(status);
  return { ok: true };
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
    if (p.action === "activity") { if (!keyOk_(p.key)) return json_({ error: "Invalid admin key" }); return json_(activity_()); }
    if (p.action === "messages") { if (!keyOk_(p.key)) return json_({ error: "Invalid admin key" }); return json_({ messages: readMessages_() }); }
    if (p.action === "portal") {
      if (p.token) {
        const em = fromToken_(p.token);
        if (em) logActivity_(em, "visit");
        return json_(em ? portalData_(em) : { ok: false, expired: true, message: "Please sign in again." });
      }
      return json_(portal_(p.email, p.phone4));
    }
    if (p.action === "announcements") return json_({ announcements: readAnn_().filter(a => a.audience === "all") });
    if (p.action === "file") return json_(getAttachment_(p.id, p.token, p.key));
    return json_({ ok: true, service: "Nuqta-e-Aghaz API" });
  } catch (err) { return json_({ error: String(err) }); }
}

function doPost(e) {
  try {
    const p = JSON.parse(e.postData.contents || "{}");
    if (p.action === "login") return json_(login_(p.user, p.pass));
    if (p.action === "sendMessage") return json_(sendMessage_(p.token, p.topic, p.message, p.attachment));
    if (p.action === "resetRequest") return json_(resetRequest_(p.user));
    if (p.action === "resetConfirm") return json_(resetConfirm_(p.user, p.code, p.pass));
    if (p.action === "changePassword") return json_(changePassword_(p.token, p.pass));
    if (!keyOk_(p.key)) return json_({ error: "Invalid admin key" });
    if (p.action === "sendReminders") return json_(startReminders_(["all", "Ambassador", "Participant"].indexOf(p.group) >= 0 ? p.group : "all", p.channel || "email"));
    if (p.action === "remindPeople") return json_(remindPeople_([].concat(p.emails || []).slice(0, 200), p.channel));
    if (p.action === "sendLogin") return json_(sendLoginNow_([].concat(p.emails || []).slice(0, 200)));
    if (p.action === "replyMessage" || p.action === "messageStatus") {
      const r = p.action === "replyMessage" ? replyMessage_(p.id, p.reply, p.attachment) : setMessageStatus_(p.id, p.status);
      return json_(r.error ? r : { ok: true, messages: readMessages_() });
    }
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
