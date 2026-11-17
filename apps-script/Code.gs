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
/* Responses are read straight from the Google Forms (all old + new ones).
   The spreadsheet this script lives in only keeps ambassador codes and announcements,
   so the forms' own response sheets are never touched. */
function setup() {
  annSheet_(); codeSheet_();
  assignAmbassadorCodes_(false);
  ScriptApp.getProjectTriggers().forEach(tr => ScriptApp.deleteTrigger(tr));
  Object.keys(FORM_IDS).forEach(k => {
    ScriptApp.newTrigger("onAnySubmit").forForm(FORM_IDS[k]).onFormSubmit().create();
    Logger.log("✓ " + TABS[k] + ": " + FormApp.openById(FORM_IDS[k]).getResponses().length + " responses");
  });
  ScriptApp.newTrigger("refreshAll").timeBased().everyMinutes(5).create();
  refreshAll();
  Logger.log("✅ Setup complete. Now Deploy → New deployment → Web app.");
}

/* Runs on every form submission (installed by setup) */
function onAnySubmit(e) {
  CacheService.getScriptCache().removeAll(["stats"].concat(Object.keys(TABS).map(k => "rows_" + k)));
  if (e && e.source && e.source.getId() === FORM_IDS.ambassador) assignAmbassadorCodes_(SEND_AMBASSADOR_EMAIL);
  refreshAll();
}

/* Reads every form once and keeps the results ready, so the dashboard and portal open instantly.
   setup() runs this every 5 minutes; it also runs after each form submission. */
const CACHE_SECONDS = 6 * 3600;
function refreshAll() {
  const cache = CacheService.getScriptCache();
  cache.removeAll(["stats"].concat(Object.keys(TABS).map(k => "rows_" + k)));
  Object.keys(TABS).forEach(k => readTab_(k));
  stats_();
}

/* Run this ONCE by hand if you want every existing ambassador emailed their code + link */
function emailExistingAmbassadors() {
  assignAmbassadorCodes_(false);
  codeRows_().forEach(c => { if (c.email && c.code) sendCodeEmail_(c.email, c.name, c.code); });
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

/* -------------------- ambassador codes -------------------- */
/* "Ambassador Codes" tab: Email | Name | Code | Status. Edit a Code to override it,
   or write "rejected" in Status to remove someone. New ambassadors get the next number. */
const CODE_TAB = "Ambassador Codes";
function codeSheet_() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(CODE_TAB);
  if (!sh) { sh = ss.insertSheet(CODE_TAB); sh.appendRow(["Email", "Name", "Code", "Status", "Registered"]); sh.setFrozenRows(1); }
  return sh;
}
function codeRows_() {
  const v = codeSheet_().getDataRange().getValues().slice(1);
  return v.filter(r => r[0]).map(r => ({ email: String(r[0]).trim().toLowerCase(), name: String(r[1] || ""), code: normCode_(r[2]), status: String(r[3] || "").toLowerCase() }));
}
function assignAmbassadorCodes_(sendEmail) {
  const sh = codeSheet_(), have = codeRows_(), known = new Set(have.map(c => c.email));
  let next = have.reduce((m, c) => { const n = parseInt(String(c.code).replace(/\D/g, ""), 10); return n > m ? n : m; }, 0);
  const rows = readForm_("ambassador").slice().sort((a, b) => a.ts - b.ts), add = [];
  rows.forEach(r => {
    if (!r.email || known.has(r.email)) return;
    known.add(r.email); next++;
    const code = CODE_PREFIX + String(next).padStart(CODE_DIGITS, "0");
    add.push([r.email, r.name, code, "", r.ts]);
    if (sendEmail) sendCodeEmail_(r.email, r.name, code);
  });
  if (add.length) sh.getRange(sh.getLastRow() + 1, 1, add.length, 5).setValues(add);
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
      else if (!o.ref && COL.ref.test(t)) o.ref = normCode_(v);
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
    const byEmail = {}; codeRows_().forEach(c => (byEmail[c.email] = c));
    rows = rows.map(r => { const c = byEmail[r.email] || {}; return Object.assign({}, r, { code: c.code || "", status: c.status || "" }); })
      .filter(r => r.status !== "rejected");
  }
  return rows;
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
  try { cache.put("stats", JSON.stringify(out), CACHE_SECONDS); } catch (e) { /* too big to cache */ }
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
