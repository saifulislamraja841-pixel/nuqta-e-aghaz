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
const SEND_AMBASSADOR_EMAIL = true;                       // email new ambassadors their code + link

/* Names of the response tabs inside the master spreadsheet.
   setup() finds the tabs linked to FORM_IDS below and renames them for you. */
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
};
const CODE_PREFIX = "NEA";   // codes look like NEA01, NEA02 … (the format your Competitions form asks for)
const CODE_DIGITS = 2;
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
function setup() {
  const ss = SpreadsheetApp.getActive();
  let ann = ss.getSheetByName(ANN_TAB);
  if (!ann) {
    ann = ss.insertSheet(ANN_TAB);
    ann.appendRow(["ID", "Timestamp", "Title", "Message", "Audience", "Link", "Pinned"]);
    ann.setFrozenRows(1);
  }
  linkFormTabs_();
  Object.values(TABS).forEach(t => { if (!ss.getSheetByName(t)) Logger.log("ℹ Tab not found (fine if you don't use this form yet): " + t); });
  assignAmbassadorCodes_(false);
  ScriptApp.getProjectTriggers().forEach(tr => { if (tr.getHandlerFunction() === "onAnySubmit") ScriptApp.deleteTrigger(tr); });
  ScriptApp.newTrigger("onAnySubmit").forSpreadsheet(ss).onFormSubmit().create();
  Logger.log("✅ Setup complete. Now Deploy → New deployment → Web app.");
}

/* Runs on every form submission (installed by setup) */
function onAnySubmit(e) {
  const sheet = e && e.range ? e.range.getSheet() : null;
  if (sheet && sheet.getName() === TABS.ambassador) assignAmbassadorCodes_(SEND_AMBASSADOR_EMAIL);
  CacheService.getScriptCache().remove("stats");
}

/* Finds the response tab of each form in FORM_IDS and renames it to the TABS name */
function linkFormTabs_() {
  const ss = SpreadsheetApp.getActive();
  Object.keys(FORM_IDS).forEach(k => {
    if (ss.getSheetByName(TABS[k])) return;
    const sh = ss.getSheets().find(s => { const u = s.getFormUrl(); return u && u.indexOf(FORM_IDS[k]) >= 0; })
      || ss.getSheets().find(s => { const u = s.getFormUrl(); return u && FormApp.openByUrl(u).getId() === FORM_IDS[k]; });
    if (sh) { sh.setName(TABS[k]); Logger.log("✓ " + TABS[k] + " tab linked"); }
    else Logger.log("⚠ No tab linked to the " + TABS[k] + " form yet. In the form: Responses → Link to Sheets → Select existing spreadsheet → this one.");
  });
}

/* Run this ONCE by hand if you want every existing ambassador emailed their code + link */
function emailExistingAmbassadors() { assignAmbassadorCodes_(false); emailCodes_(true); }
function emailCodes_(all) {
  const sh = SpreadsheetApp.getActive().getSheetByName(TABS.ambassador);
  if (!sh || sh.getLastRow() < 2) return;
  readTab_("ambassador").forEach(a => { if (a.code && a.email) sendCodeEmail_(a.email, a.name, a.code); });
}
function sendCodeEmail_(to, name, code) {
  try {
    const link = SITE_URL + "index.html?ref=" + code;
    MailApp.sendEmail({
      to: String(to).trim(),
      subject: "Your Nuqta-e-Aghaz Ambassador Code: " + code,
      htmlBody: "Assalam o Alaikum " + (name || "") + ",<br><br>Welcome to the Nuqta-e-Aghaz Campus Ambassador Program!<br><br>" +
        "Your code: <b style='font-size:18px'>" + code + "</b><br>Your referral link: <a href='" + link + "'>" + link + "</a><br><br>" +
        "Ask friends to enter " + code + " in the \"Ambassador Referral Code\" field, or share your link and it is filled in for them. " +
        "Track your referrals (only you can see them) in My Portal: <a href='" + SITE_URL + "portal.html'>" + SITE_URL + "portal.html</a><br><br>— Team Nuqta-e-Aghaz",
    });
  } catch (err) { Logger.log("Email failed: " + err); }
}

/* Gives every ambassador row a code like NEA07 in an "Ambassador Code" column */
function assignAmbassadorCodes_(sendEmail) {
  const sh = SpreadsheetApp.getActive().getSheetByName(TABS.ambassador);
  if (!sh || sh.getLastRow() < 2) return;
  let head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  let ci = head.findIndex(h => COL.code.test(String(h)));
  if (ci < 0) { ci = head.length; sh.getRange(1, ci + 1).setValue("Ambassador Code"); head.push("Ambassador Code"); }
  const ei = head.findIndex(h => COL.email.test(String(h)));
  const ni = head.findIndex(h => COL.name.test(String(h)));
  const n = sh.getLastRow() - 1;
  const codes = sh.getRange(2, ci + 1, n, 1).getValues();
  const data = sh.getRange(2, 1, n, head.length).getValues();
  let changed = false;
  codes.forEach((c, i) => {
    if (!c[0]) {
      c[0] = CODE_PREFIX + String(i + 1).padStart(CODE_DIGITS, "0"); changed = true;
      if (sendEmail && ei >= 0 && data[i][ei]) sendCodeEmail_(data[i][ei], ni >= 0 ? data[i][ni] : "", c[0]);
    }
  });
  if (changed) sh.getRange(2, ci + 1, n, 1).setValues(codes);
}

/* -------------------- reading the sheets -------------------- */
function readTab_(key) {
  const sh = SpreadsheetApp.getActive().getSheetByName(TABS[key]);
  if (!sh || sh.getLastRow() < 2) return [];
  const values = sh.getDataRange().getValues();
  const head = values[0].map(String);
  const find = re => head.findIndex(h => re.test(h));
  const idx = { email: find(COL.email), name: head.findIndex(h => COL.name.test(h) && !COL.uni.test(h)), phone: find(COL.phone), ref: find(COL.ref), comp: find(COL.comp), uni: find(COL.uni), code: find(COL.code), status: find(COL.status) };
  if (idx.ref === idx.code) idx.ref = -1;
  return values.slice(1).filter(r => r.join("").trim() !== "").map(r => {
    const get = i => (i >= 0 ? String(r[i] == null ? "" : r[i]).trim() : "");
    return {
      ts: r[0] instanceof Date ? r[0] : new Date(r[0]),
      email: get(idx.email).toLowerCase(), name: get(idx.name), phone: get(idx.phone).replace(/\D/g, ""),
      ref: normCode_(get(idx.ref)), comp: get(idx.comp), uni: get(idx.uni), code: normCode_(get(idx.code)), status: get(idx.status).toLowerCase(),
    };
  }).filter(r => r.status !== "rejected");
}
function normCode_(s) {
  s = String(s || "").toUpperCase().replace(/[\s_.]+/g, "");
  const m = s.match(/^(?:NEA|NA|NE|N)?-?0*(\d{1,4})$/);
  return m ? CODE_PREFIX + m[1].padStart(CODE_DIGITS, "0") : s;
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
  const byCode = {}; amb.forEach(a => (byCode[a.code] = { code: a.code, name: a.name, university: a.uni, main: 0, competitions: 0, talent: 0, total: 0 }));
  let invalid = 0;
  [["main", D.main], ["competitions", D.competitions], ["talent", D.talent]].forEach(([k, rows]) => uniq(rows).forEach(r => {
    if (!r.ref) return;
    if (byCode[r.ref]) { byCode[r.ref][k]++; byCode[r.ref].total++; } else invalid++;
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
    totals: { main: uniq(D.main).length, ambassadors: amb.length, referred: uniq(D.main).filter(r => r.ref && byCode[r.ref]).length,
      competitionPeople: uniq(D.competitions).length, competitionEntries: entries, talent: uniq(D.talent).length, stalls: uniq(D.stall).length },
    crossover: { ambassadors: cross(D.ambassador), competitions: cross(D.competitions), talent: cross(D.talent), stalls: cross(D.stall) },
    competitions: Object.keys(compCount).map(n => ({ name: n, count: compCount[n] })),
    universities: Object.keys(uniCount).map(n => ({ name: n, count: uniCount[n] })).sort((a, b) => b.count - a.count).slice(0, 12),
    timeline, leaderboard, recent: recent.slice(0, 12), invalidRefs: invalid, announcements: readAnn_(),
  };
  cache.put("stats", JSON.stringify(out), 60);
  return out;
}

/* -------------------- PORTAL -------------------- */
function portal_(email, phone4) {
  email = String(email || "").trim().toLowerCase(); phone4 = String(phone4 || "").replace(/\D/g, "");
  if (!email || phone4.length !== 4) return { ok: false, message: "Enter your email and the last 4 digits of your phone." };
  const D = {}; Object.keys(TABS).forEach(k => (D[k] = readTab_(k).filter(r => r.email === email)));
  const mine = [].concat(D.main, D.ambassador, D.competitions, D.talent, D.stall);
  if (!mine.length) return { ok: false, message: "No registration found for this email. Use the email you entered in the form." };
  if (!mine.some(r => r.phone && r.phone.slice(-4) === phone4)) return { ok: false, message: "Those phone digits don't match our records." };
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
    if (p.action === "portal") return json_(portal_(p.email, p.phone4));
    if (p.action === "announcements") return json_({ announcements: readAnn_().filter(a => a.audience === "all") });
    return json_({ ok: true, service: "Nuqta-e-Aghaz API" });
  } catch (err) { return json_({ error: String(err) }); }
}

function doPost(e) {
  try {
    const p = JSON.parse(e.postData.contents || "{}");
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
