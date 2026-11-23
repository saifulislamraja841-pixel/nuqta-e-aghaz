/* ============ NUQTA-E-AGHAZ — shared core ============ */
(function () {
  const C = window.NUQTA_CONFIG || {};
  const N = (window.Nuqta = { C });

  /* ---------- tiny helpers ---------- */
  N.$ = (s, r = document) => r.querySelector(s);
  N.$$ = (s, r = document) => [...r.querySelectorAll(s)];
  N.esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  N.fmt = (n) => Number(n || 0).toLocaleString("en-PK");
  N.isDemo = () => !C.scriptUrl;
  N.store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} },
  };
  N.session = {
    get(k) { try { return JSON.parse(sessionStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { sessionStorage.removeItem(k); } catch (e) {} },
  };
  N.toast = (msg) => {
    let t = N.$(".toast");
    if (!t) { t = document.createElement("div"); t.className = "toast"; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("show");
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 2600);
  };
  N.copy = async (txt) => {
    try { await navigator.clipboard.writeText(txt); N.toast("Copied to clipboard"); }
    catch (e) { const a = document.createElement("textarea"); a.value = txt; document.body.appendChild(a); a.select(); document.execCommand("copy"); a.remove(); N.toast("Copied"); }
  };
  N.timeAgo = (d) => {
    const s = (Date.now() - new Date(d)) / 1000;
    if (s < 60) return "just now"; if (s < 3600) return Math.floor(s / 60) + "m ago";
    if (s < 86400) return Math.floor(s / 3600) + "h ago"; if (s < 86400 * 7) return Math.floor(s / 86400) + "d ago";
    return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  };
  N.siteBase = () => location.href.replace(/[#?].*$/, "").replace(/[^/]*$/, "");

  /* ---------- icons ---------- */
  const P = {
    cal: '<rect x="3" y="4.5" width="18" height="16" rx="3"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    pin: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    star: '<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.5 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    rocket: '<path d="M14 4c3 0 6 3 6 6l-7 7-6-6 7-7z"/><path d="M7 11l-3 1 2 2M13 17l-1 3-2-2"/><circle cx="15" cy="9" r="1.5"/>',
    bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3z"/>',
    gift: '<rect x="3.5" y="8" width="17" height="4" rx="1"/><path d="M5 12v8h14v-8M12 8v12M12 8s-1.5-4-4-4a2 2 0 0 0 0 4M12 8s1.5-4 4-4a2 2 0 0 1 0 4"/>',
    laugh: '<circle cx="12" cy="12" r="9"/><path d="M8 14a4 4 0 0 0 8 0zM9 9.5h.01M15 9.5h.01"/>',
    quill: '<path d="M20 4C11 4 6 10 5 19"/><path d="M5 19c4-1 9-4 11-9"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',
    check: '<path d="M4 12.5l5 5L20 6.5"/>',
    whatsapp: '<path d="M4 20l1.3-4A8 8 0 1 1 8 19z"/><path d="M9 9c0 3 3 6 6 6l1.2-1.4-2-1-1 .8A4 4 0 0 1 11 11.2l.8-1-1-2z"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H4a3 3 0 0 0 4 4M16 6h4a3 3 0 0 1-4 4M12 13v4M8 21h8M9.5 17h5"/>',
    store: '<path d="M4 9l1.5-5h13L20 9M4 9v11h16V9M4 9a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0A2.7 2.7 0 0 0 20 9M10 20v-5h4v5"/>',
    send: '<path d="M21 3L10 14M21 3l-7 18-4-7-7-4z"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
    logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10"/>',
    refresh: '<path d="M20 11A8 8 0 0 0 5.5 7M4 4v4h4M4 13a8 8 0 0 0 14.5 4M20 20v-4h-4"/>',
    share: '<path d="M12 15V3M8 7l4-4 4 4"/><path d="M7 10H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-1"/>',
    addbox: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8.5v7M8.5 12h7"/>',
    dots: '<circle cx="12" cy="5.5" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="12" cy="18.5" r="1.3"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
    phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
    grid: '<rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    clip: '<path d="M20 11.5l-8 8a5 5 0 0 1-7-7l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7L9.7 17.2a1.7 1.7 0 0 1-2.4-2.4l7.6-7.6"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M15 8l2 2"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    pinned: '<path d="M9 4h6l-1 6 3 3H7l3-3zM12 13v8"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3.5 6.5l8.5 6 8.5-6"/>',
    ig: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/>',
    fb: '<path d="M14 21v-8h3l.5-3.5H14V7.5c0-1 .4-1.7 1.8-1.7H18V2.7A22 22 0 0 0 15.3 2.5C12.6 2.5 10.6 4 10.6 7v2.5H7.5V13h3.1v8"/>',
    li: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 10v7M8 7h.01M12 17v-4a2 2 0 0 1 4 0v4M12 10v7"/>',
  };
  N.icon = (n, cls = "") => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ""}</svg>`;
  N.hydrateIcons = (root = document) => N.$$("[data-icon]", root).forEach((el) => { el.innerHTML = N.icon(el.dataset.icon) + el.innerHTML; el.removeAttribute("data-icon"); });

  /* ---------- referral capture (?ref=CODE) ---------- */
  N.getRef = () => {
    const r = N.store.get("nuqta_ref");
    if (r && r.exp > Date.now()) return r.code;
    return "";
  };
  (function captureRef() {
    const q = new URLSearchParams(location.search).get("ref");
    if (q && /^[A-Za-z0-9-]{2,20}$/.test(q)) {
      let code = q.toUpperCase();
      const m = code.match(/^(?:NEA|NA|NE|N)?-?0*(\d{1,4})$/);   // nea7, NA-07, 7 → NEA07
      if (m) code = "NEA" + m[1].padStart(2, "0");
      N.store.set("nuqta_ref", { code, exp: Date.now() + 30 * 864e5 });
    }
  })();

  /* ---------- Google Form modal ---------- */
  N.formUrl = (key, embedded = true) => {
    const f = (C.forms || {})[key];
    if (!f || !f.url) return "";
    const u = new URL(f.url);
    if (embedded) u.searchParams.set("embedded", "true");
    const ref = N.getRef();
    if (ref && f.refEntry) { u.searchParams.set("usp", "pp_url"); u.searchParams.set(f.refEntry, ref); }
    return u.toString();
  };
  N.openForm = (key) => {
    const f = (C.forms || {})[key] || { title: "Registration" };
    if (f.newTab && f.url) { window.open(N.formUrl(key, false), "_blank", "noopener"); return; }
    let m = N.$("#formModal");
    if (!m) {
      m = document.createElement("div");
      m.id = "formModal"; m.className = "modal"; m.setAttribute("role", "dialog"); m.setAttribute("aria-modal", "true");
      m.innerHTML = `<div class="modal-box"><div class="modal-top"><h3></h3><span class="ref"></span><button class="x" aria-label="Close">×</button></div>
        <div class="modal-body"></div><div class="modal-foot"><span>Secure Google Form · responses go straight to the organising team</span><a class="btn btn-ghost btn-sm" target="_blank" rel="noopener">Open in new tab ↗</a></div></div>`;
      document.body.appendChild(m);
      m.addEventListener("click", (e) => { if (e.target === m || e.target.closest(".x")) N.closeForm(); });
      document.addEventListener("keydown", (e) => { if (e.key === "Escape") N.closeForm(); });
    }
    N.$("h3", m).textContent = f.title;
    const ref = N.getRef();
    N.$(".ref", m).textContent = ref && f.refEntry ? "Referral: " + ref : "";
    const body = N.$(".modal-body", m), open = N.$(".modal-foot a", m);
    const url = N.formUrl(key);
    if (!url) {
      body.innerHTML = `<div class="modal-empty"><div><h4>Registration opens shortly</h4><p>This form link hasn't been connected yet.<br>Meanwhile, message us on WhatsApp and we'll register you right away.</p>
        <p style="margin-top:20px"><a class="btn btn-primary" target="_blank" rel="noopener" href="https://wa.me/${C.contact?.whatsapp}?text=${encodeURIComponent("Assalam o Alaikum! I'd like to register for " + f.title + " — Nuqta-e-Aghaz")}">${N.icon("whatsapp")} WhatsApp ${N.esc(C.contact?.phone || "")}</a></p></div></div>`;
      open.style.display = "none";
    } else {
      body.innerHTML = `<div class="modal-empty"><div class="spinner"></div></div><iframe title="${N.esc(f.title)}" src="${url}" loading="lazy"></iframe>`;
      N.$("iframe", body).addEventListener("load", () => { const s = N.$(".modal-empty", body); s && s.remove(); });
      open.style.display = ""; open.href = N.formUrl(key, false);
    }
    m.classList.add("open"); document.body.style.overflow = "hidden";
  };
  N.closeForm = () => { const m = N.$("#formModal"); if (m && m.classList.contains("open")) { m.classList.remove("open"); N.$(".modal-body", m).innerHTML = ""; document.body.style.overflow = ""; } };
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-form]");
    if (b) { e.preventDefault(); N.openForm(b.dataset.form); }
  });

  /* ---------- API (Google Apps Script) ---------- */
  N.api = async (action, params = {}) => {
    if (N.isDemo()) return N.demo(action, params);
    const u = new URL(C.scriptUrl);
    u.searchParams.set("action", action);
    Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
    const r = await fetch(u.toString(), { redirect: "follow" });
    const j = await r.json();
    if (j.error) throw new Error(j.error);
    return j;
  };
  N.post = async (payload) => {
    if (N.isDemo()) return N.demoPost(payload);
    const r = await fetch(C.scriptUrl, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) });
    const j = await r.json();
    if (j.error) throw new Error(j.error);
    return j;
  };

  /* ---------- chat attachments: photos + voice notes ---------- */
  /* N.attacher(el) puts "Photo" and "Voice note" buttons in el. .get() returns the attachment
     ({kind, mime, data (base64), duration}) or null; .clear() removes it. */
  const blobToB64 = (b) => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1]); r.onerror = no; r.readAsDataURL(b); });
  const shrinkImage = (file) => new Promise((ok, no) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const max = 1600, k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement("canvas");
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); c.toBlob((b) => b ? ok(b) : no(new Error("Could not read this photo")), "image/jpeg", 0.82);
    };
    img.onerror = () => { URL.revokeObjectURL(url); no(new Error("This file is not a photo we can read")); };
    img.src = url;
  });
  const fmtDur = (s) => Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0");
  /* Documents people can attach (6 MB at most) */
  const FILE_TYPES = { pdf: "application/pdf", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    txt: "text/plain", csv: "text/csv", zip: "application/zip", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
  const FILE_MAX = 6 * 1024 * 1024;
  const fmtSize = (n) => n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB";
  /* ---------- microphone blocked: show how to allow it ---------- */
  let micWaiting = null;            // Android app: the voice note button waiting for the microphone
  window.addEventListener("nuqta-mic-on", () => {
    const w = micWaiting; micWaiting = null;
    if (w && Date.now() - w.at < 5 * 60 * 1000 && document.body.contains(w.btn)) w.btn.click();   // start the voice note
  });
  /* Which Android app is this page running in? 0 = a normal browser.
     1 = first app (Nov 20): no microphone, no file picker.  3 = Nov 22 app: microphone + files, no settings button.
     4 = Nov 23 app and later: asks for the microphone and opens settings itself. */
  N.appBuild = () => {
    if (!/NuqtaApp/.test(navigator.userAgent)) return 0;
    const A = window.NuqtaApp || {};
    return A.requestMic ? 4 : A.saveFile ? 3 : 1;
  };
  /* Links the older apps open outside themselves (they hand "intent:" links to Android) */
  const SETTINGS_LINK = "intent:org.nuqtaeaghaz.app#Intent;scheme=package;action=android.settings.APPLICATION_DETAILS_SETTINGS;end";
  const chromeLink = () => "intent://" + location.host + location.pathname + location.search + "#Intent;scheme=https;package=com.android.chrome;end";
  /* what: "mic" | "file" */
  N.micHelp = (err, retry, what = "mic") => {
    const ua = navigator.userAgent, build = N.appBuild();
    const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    const android = /Android/.test(ua);
    const noApi = what === "mic" && (!navigator.mediaDevices || !window.MediaRecorder);
    let title, intro, steps, action = "";
    if (build === 1) {                                   // oldest app: can't do it at all → Chrome
      title = "Open the portal in Chrome";
      intro = (what === "mic" ? "Voice notes" : "Photos and files") + " can't be sent from this version of the app. They work in Chrome:";
      steps = ["Tap <b>Open in Chrome</b> below.", "Sign in to your portal there (same username and password).", "Send your " + (what === "mic" ? "voice note" : "photo or file") + " from there."];
      action = `<a class="btn btn-primary btn-sm" href="${chromeLink()}">Open in Chrome</a>`;
    } else if (build === 3) {                            // Nov 22 app: microphone switched off for the app
      title = "Allow the microphone";
      intro = "The microphone is turned off for the Nuqta app. Turn it on once:";
      steps = ["Tap <b>Open settings</b> below.", "Tap <b>Permissions</b> → <b>Microphone</b> → <b>Allow</b>.", "Come back to the app and tap <b>Voice note</b> again."];
      action = `<a class="btn btn-primary btn-sm" href="${SETTINGS_LINK}">Open settings</a>`;
    } else if (noApi) {
      title = "Open in Chrome or Safari";
      intro = "This browser can't record voice notes.";
      steps = ios ? ["Tap the share or ⋯ button and choose <b>Open in Safari</b>.", "Open the portal there and tap <b>Voice note</b> again."]
        : ["Tap ⋮ and choose <b>Open in Chrome</b> (WhatsApp's own browser can't record).", "Open the portal there and tap <b>Voice note</b> again."];
    } else {
      title = "Allow the microphone";
      intro = "Your phone has blocked the microphone for this site, so it can't ask you again. Turn it on like this:";
      steps = ios ? ["Open the iPhone <b>Settings</b> app.", "Go to <b>Apps → Safari → Microphone</b> (on older iPhones: <b>Safari → Microphone</b>).", "Choose <b>Allow</b> or <b>Ask</b>.", "Come back here and tap <b>Try again</b>. If it still doesn't ask, close Safari fully and open the portal again."]
        : android ? ["Tap the icon to the left of the web address (or ⋮ → ⓘ).", "Tap <b>Permissions</b> and turn <b>Microphone</b> on.", "Still blocked? Open phone <b>Settings → Apps → Chrome → Permissions → Microphone → Allow</b>.", "Come back here and tap <b>Try again</b>."]
        : ["Click the icon to the left of the web address.", "Set <b>Microphone</b> to <b>Allow</b>.", "Tap <b>Try again</b>."];
      action = `<button type="button" class="btn btn-primary btn-sm mic-retry">${N.icon("mic")}Try again</button>`;
    }
    let m = N.$("#micModal");
    if (!m) {
      m = document.createElement("div");
      m.id = "micModal"; m.className = "modal"; m.setAttribute("role", "dialog"); m.setAttribute("aria-modal", "true");
      document.body.appendChild(m);
      m.addEventListener("click", (e) => { if (e.target === m || e.target.closest(".x, .mic-close, a.btn")) m.classList.remove("open"); });
    }
    m.innerHTML = `<div class="modal-box sm"><div class="modal-top"><h3>${title}</h3><button class="x" aria-label="Close">×</button></div>
      <div class="mic-help"><p>${intro}</p><ol>${steps.map((x) => `<li>${x}</li>`).join("")}</ol>
      <div class="mic-btns"><button type="button" class="btn btn-ghost btn-sm mic-close">Not now</button>${action}</div></div></div>`;
    const r = N.$(".mic-retry", m);
    if (r) r.addEventListener("click", () => { m.classList.remove("open"); if (retry) retry(); });
    m.classList.add("open");
  };
  N.attacher = (el, { maxVoice = 120, onSend = null } = {}) => {
    let att = null, rec = null, timer = null, started = 0, stream = null, after = "";   // after: "" | "cancel" | "send"
    el.classList.add("attacher");
    el.innerHTML = `<div class="att-btns"><label class="btn btn-ghost btn-sm att-photo">${N.icon("image")}Photo<input type="file" accept="image/*" hidden></label>
      <button type="button" class="btn btn-ghost btn-sm att-voice">${N.icon("mic")}Voice note</button>
      <label class="btn btn-ghost btn-sm att-file">${N.icon("clip")}File<input type="file" accept="${Object.keys(FILE_TYPES).map((x) => "." + x).join(",")}" hidden></label></div><div class="att-prev"></div>`;
    const prev = N.$(".att-prev", el), vbtn = N.$(".att-voice", el), photo = N.$(".att-photo input", el), doc = N.$(".att-file input", el);
    N.$$(".att-photo, .att-file", el).forEach((l) => l.addEventListener("click", (e) => {     // oldest app has no file picker
      if (N.appBuild() === 1) { e.preventDefault(); N.micHelp(null, null, "file"); }
    }));
    const show = () => {
      if (rec && rec.state === "recording") {               // recording: timer + Cancel / Send
        prev.innerHTML = `<div class="rec-bar"><span class="rec-dot"></span><span class="rec-t">0:00</span><span class="rec-l">Recording…</span>
          <button type="button" class="btn btn-ghost btn-sm rec-cancel">${N.icon("x")}Cancel</button>
          <button type="button" class="btn btn-ghost btn-sm rec-stop" title="Stop and listen before sending">${N.icon("stop")}Stop</button>
          <button type="button" class="btn btn-primary btn-sm rec-send">${N.icon("send")}Send</button></div>`;
        N.$(".rec-cancel", prev).addEventListener("click", () => { after = "cancel"; stopRec(); });
        N.$(".rec-send", prev).addEventListener("click", () => { after = "send"; stopRec(); });
        N.$(".rec-stop", prev).addEventListener("click", () => { after = ""; stopRec(); });
        return;
      }
      if (!att) { prev.innerHTML = ""; el.classList.remove("has"); return; }
      el.classList.add("has");
      const src = att.url;
      prev.innerHTML = `<div class="att-chip">${att.kind === "image" ? `<img src="${src}" alt="Photo to send">`
        : att.kind === "voice" ? `<audio controls preload="metadata" src="${src}"></audio><span class="dur">${fmtDur(att.duration)}</span>`
        : `<span class="file-ic">${N.icon("clip")}</span><span class="fname">${N.esc(att.name)}<small>${fmtSize(att.blob.size)}</small></span>`}
        <button type="button" class="icon-btn" title="Delete" aria-label="Delete">${N.icon("trash")}</button></div>`;
      N.$(".icon-btn", prev).addEventListener("click", () => api.clear());
    };
    photo.addEventListener("change", async () => {
      const f = photo.files[0]; photo.value = ""; if (!f) return;
      try { const b = await shrinkImage(f); api.clear(); att = { kind: "image", mime: "image/jpeg", blob: b, url: URL.createObjectURL(b), duration: 0 }; show(); }
      catch (e) { N.toast(e.message); }
    });
    doc.addEventListener("change", () => {
      const f = doc.files[0]; doc.value = ""; if (!f) return;
      const ext = (f.name.match(/\.([a-z0-9]+)$/i) || [])[1];
      if (!ext || !FILE_TYPES[ext.toLowerCase()]) return N.toast("You can attach PDF, Word, Excel, PowerPoint, text, CSV, ZIP or image files.");
      if (f.size > FILE_MAX) return N.toast("That file is " + fmtSize(f.size) + ". Files can be 6 MB at most.");
      api.clear(); att = { kind: "file", mime: FILE_TYPES[ext.toLowerCase()], blob: f, name: f.name, url: "", duration: 0 }; show();
    });
    const stopRec = () => { if (rec && rec.state !== "inactive") rec.stop(); };
    vbtn.addEventListener("click", async () => {
      if (rec && rec.state === "recording") return stopRec();
      if (N.appBuild() === 1 || !navigator.mediaDevices || !window.MediaRecorder) return N.micHelp(null, () => vbtn.click());
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
      catch (e) {
        if (e && e.name === "NotFoundError") return N.toast("No microphone was found on this device.");
        if (window.NuqtaApp && window.NuqtaApp.requestMic) {     // Android app: it shows its own Allow / Open settings pop-up
          micWaiting = { btn: vbtn, at: Date.now() }; return;     // the recording starts by itself once it's allowed
        }
        return N.micHelp(e, () => vbtn.click());
      }
      const type = ["audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/webm;codecs=opus", "audio/webm"].find((t) => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || "";
      const chunks = [];
      rec = new MediaRecorder(stream, Object.assign({ audioBitsPerSecond: 48000 }, type ? { mimeType: type } : {}));
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = () => {
        clearInterval(timer); stream.getTracks().forEach((t) => t.stop()); el.classList.remove("rec");
        vbtn.innerHTML = N.icon("mic") + "Voice note";
        const what = after; after = "";
        const dur = (Date.now() - started) / 1000, mime = (rec.mimeType || type || "audio/webm").split(";")[0];
        if (what === "cancel") { show(); return N.toast("Voice note deleted."); }
        if (dur < 1 || !chunks.length) { show(); return N.toast("That recording was too short."); }
        const b = new Blob(chunks, { type: mime });
        api.clear(); att = { kind: "voice", mime, blob: b, url: URL.createObjectURL(b), duration: Math.round(dur) }; show();
        if (what === "send" && onSend) onSend();
      };
      rec.start(500); started = Date.now(); el.classList.add("rec"); show();
      const tick = () => { const s = (Date.now() - started) / 1000, t = N.$(".rec-t", prev); if (t) t.textContent = fmtDur(s); vbtn.innerHTML = N.icon("stop") + "Stop · " + fmtDur(s); if (s >= maxVoice) stopRec(); };
      tick(); timer = setInterval(tick, 250);
    });
    const api = {
      async get() { stopRec(); if (!att) return null; return { kind: att.kind, mime: att.mime, duration: att.duration, name: att.name || "", data: await blobToB64(att.blob) }; },
      has: () => !!att,
      recording: () => !!(rec && rec.state === "recording"),
      clear() { if (rec && rec.state === "recording") { after = "cancel"; stopRec(); } if (att && att.url) URL.revokeObjectURL(att.url); att = null; show(); },
    };
    return api;
  };
  /* A placeholder for a sent attachment; N.loadAttachments fills it in.
     Photos and voice notes load straight away; documents download when tapped. */
  N.attHtml = (a) => {
    if (!a) return "";
    const k = a.kind === "voice" ? "voice" : a.kind === "file" ? "file" : "image";
    const inner = k === "voice" ? `${N.icon("mic")}<span>Voice note${a.duration ? " · " + fmtDur(a.duration) : ""}</span><span class="spinner sm"></span>`
      : k === "file" ? `<button type="button" class="file-dl"><span class="file-ic">${N.icon("clip")}</span><span class="fname">${N.esc(a.name || "File")}<small>${a.size ? fmtSize(a.size) + " · " : ""}Tap to download</small></span>${N.icon("download")}</button>`
      : `<span class="spinner sm"></span>`;
    return `<div class="att-view ${k}" data-att="${N.esc(a.id)}" data-mime="${N.esc(a.mime || "")}" data-name="${N.esc(a.name || "")}">${inner}</div>`;
  };
  const attCache = new Map();
  const fetchRaw = async (id, mime, auth) => {
    let hit = attCache.get(id);
    if (hit) return hit;
    const r = await N.api("file", Object.assign({ id }, auth));
    if (!r.ok) throw new Error(r.message || "Could not load");
    const bin = atob(r.data), u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    hit = { b64: r.data, mime: r.mime || mime, url: URL.createObjectURL(new Blob([u8], { type: r.mime || mime })) };
    attCache.set(id, hit);
    return hit;
  };
  const fetchAtt = async (id, mime, auth) => (await fetchRaw(id, mime, auth)).url;
  /* Android app: files are saved through the app (a web download can't leave the app) */
  const inApp = () => !!(window.NuqtaApp && window.NuqtaApp.saveFile);
  N.loadAttachments = (root, auth) => N.$$("[data-att]:not([data-done])", root).forEach(async (el) => {
    el.dataset.done = "1";
    const id = el.dataset.att;
    if (el.classList.contains("file")) {
      const b = N.$(".file-dl", el), small = N.$("small", el), label = small.textContent;
      b.addEventListener("click", async () => {
        if (b.disabled) return;
        b.disabled = true; small.textContent = "Downloading…";
        try {
          const f = await fetchRaw(id, el.dataset.mime, auth);
          if (inApp()) { if (!window.NuqtaApp.saveFile(f.b64, el.dataset.name || "file", f.mime)) throw new Error("save"); }
          else { const a = document.createElement("a"); a.href = f.url; a.download = el.dataset.name || "file"; document.body.appendChild(a); a.click(); a.remove(); }
          small.textContent = label;
        } catch (e) { small.textContent = "Could not download. Try again."; }
        b.disabled = false;
      });
      return;
    }
    try {
      const url = await fetchAtt(id, el.dataset.mime, auth);
      el.innerHTML = el.classList.contains("voice") ? `<audio controls preload="metadata" src="${url}"></audio>`
        : `<a href="${url}" target="_blank" rel="noopener"><img src="${url}" alt="Photo"></a>`;
      if (inApp() && !el.classList.contains("voice")) N.$("a", el).addEventListener("click", async (e) => {   // in the app: save the photo
        e.preventDefault(); const f = await fetchRaw(id, el.dataset.mime, auth); window.NuqtaApp.saveFile(f.b64, "photo-" + id.slice(-6) + ".jpg", f.mime);
      });
    } catch (e) { el.classList.add("err"); el.innerHTML = (el.classList.contains("voice") ? "Voice note" : "Photo") + " could not be loaded"; }
  });

  /* ---------- DEMO data (used until scriptUrl is set) ---------- */
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const FN = ["Ali", "Hamza", "Ayesha", "Fatima", "Usman", "Zainab", "Bilal", "Hira", "Saad", "Maryam", "Abdullah", "Iqra", "Talha", "Noor", "Huzaifa", "Areeba", "Hassan", "Mahnoor", "Umar", "Sana"];
  const LN = ["Ahmed", "Khan", "Raza", "Malik", "Iqbal", "Butt", "Sheikh", "Chaudhry", "Qureshi", "Javed", "Aslam", "Mirza"];
  const UNI = ["UET Lahore", "UET KSK Campus", "Punjab University", "FAST Lahore", "LUMS", "COMSATS Lahore", "GCU Lahore", "UMT", "ITU", "UCP"];
  const COMPS = ["Qirat", "Naat", "Urdu Debate", "English Debate", "Painting", "Calligraphy"];
  const demoAnnouncements = () => N.store.get("nuqta_demo_ann") || [
    { id: "a3", ts: new Date(Date.now() - 3 * 3600e3).toISOString(), title: "Early-bird closes 20 November", message: "Register for the main event before 20 November to get 33% off the PKR 1,500 pass. Share your ambassador link today!", audience: "all", link: "", pinned: true },
    { id: "a2", ts: new Date(Date.now() - 26 * 3600e3).toISOString(), title: "Ambassador briefing — Thursday 5 PM", message: "All campus ambassadors: online briefing on Thursday at 5:00 PM. You'll get your poster kit and leaderboard rules.", audience: "ambassadors", link: "", pinned: false },
    { id: "a1", ts: new Date(Date.now() - 3 * 86400e3).toISOString(), title: "Competition rules published", message: "Rules and time limits for Qirat, Naat, Urdu & English Debate, Painting and Calligraphy are now available. Debate topics will be shared 48 hours before the event.", audience: "competitors", link: "", pinned: false },
  ];
  const demoMessages = () => N.store.get("nuqta_demo_msg") || [
    { id: "m3", ts: new Date(Date.now() - 40 * 60e3).toISOString(), email: "student@demo.pk", name: "Ayesha Raza", topic: "Registration / payment", message: "I paid through JazzCash yesterday but my portal still shows the main event as not registered. What should I do?", status: "Open", reply: "", repliedAt: "" },
    { id: "m2", ts: new Date(Date.now() - 5 * 3600e3).toISOString(), email: "ambassador@demo.pk", name: "Bilal Ahmed", topic: "Ambassador program", message: "Do registrations from other universities also count towards my referrals?", status: "Answered", reply: "Yes! Any registration that uses your code counts, whatever the university.", repliedAt: new Date(Date.now() - 4 * 3600e3).toISOString() },
    { id: "m1", ts: new Date(Date.now() - 26 * 3600e3).toISOString(), email: "hamza.k@demo.pk", name: "Hamza Khan", topic: "Competitions", message: "Can I take part in both Urdu Debate and English Debate?", status: "Open", reply: "", repliedAt: "" },
  ];
  N.demo = async (action, params) => {
    await new Promise((r) => setTimeout(r, 350));
    seed = 7;
    const ambassadors = Array.from({ length: 112 }, (_, i) => ({
      code: "NEA" + String(i + 1).padStart(2, "0"), name: pick(FN) + " " + pick(LN), university: pick(UNI),
    }));
    const lb = ambassadors.map((a) => {
      const main = Math.floor(Math.pow(rnd(), 1.6) * 17), comp = Math.floor(rnd() * main * 0.5), tal = Math.floor(rnd() * 4);
      return { ...a, main, competitions: comp, talent: tal, total: main + comp + tal };
    }).sort((a, b) => b.total - a.total);
    if (action === "leaderboard") {
      return { demo: true, leaderboard: lb.slice(0, Number(params.limit || 5)).map((a) => ({ name: a.name.split(" ")[0] + " " + a.name.split(" ")[1][0] + ".", university: a.university, total: a.total })) };
    }
    if (action === "announcements") return { demo: true, announcements: demoAnnouncements().filter((a) => a.audience === "all") };
    if (action === "stats") {
      const days = 30, timeline = [];
      let cum = 0;
      for (let d = days - 1; d >= 0; d--) {
        const date = new Date(Date.now() - d * 864e5).toISOString().slice(0, 10);
        const boost = d < 6 ? 2.1 : d < 14 ? 1.4 : 1;
        const main = Math.round((22 + rnd() * 40) * boost * (1 - d / 60));
        cum += main; timeline.push({ date, main, all: Math.round(main * (1.35 + rnd() * 0.3)) });
      }
      const mainTotal = cum, referred = lb.reduce((s, a) => s + a.main, 0);
      const compCounts = COMPS.map((n, i) => ({ name: n, count: [168, 214, 91, 76, 121, 96][i] }));
      const compEntries = compCounts.reduce((s, c) => s + c.count, 0);
      const recent = Array.from({ length: 10 }, (_, i) => ({
        ts: new Date(Date.now() - (i * 37 + rnd() * 30) * 60e3).toISOString(), name: pick(FN) + " " + pick(LN),
        type: pick(["Main event", "Main event", "Main event", "Competition", "Talent award", "Ambassador"]), university: pick(UNI),
        ref: rnd() > 0.45 ? pick(lb.slice(0, 30)).code : "",
      }));
      return {
        demo: true, generatedAt: new Date().toISOString(),
        totals: { main: mainTotal, ambassadors: ambassadors.length, referred, competitionPeople: 611, competitionEntries: compEntries, talent: 183, stalls: 27 },
        crossover: { ambassadors: { total: 112, inMain: 97 }, competitions: { total: 611, inMain: 448 }, talent: { total: 183, inMain: 139 }, stalls: { total: 27, inMain: 9 } },
        competitions: compCounts,
        universities: UNI.map((u, i) => ({ name: u, count: Math.round(mainTotal * [0.34, 0.08, 0.12, 0.09, 0.05, 0.07, 0.08, 0.06, 0.05, 0.06][i]) })).sort((a, b) => b.count - a.count),
        timeline, leaderboard: lb, recent, invalidRefs: 14, announcements: demoAnnouncements(),
      };
    }
    if (action === "portal") {
      const email = String(params.email || params.token || "").replace(/^demo:/, "").toLowerCase();
      const isAmb = /amb/.test(email) || !/student|guest/.test(email);
      const me = lb[6];
      return {
        demo: true, ok: true,
        profile: { name: isAmb ? me.name : "Ayesha Raza", email, university: isAmb ? me.university : "UET Lahore" },
        roles: {
          main: { registered: true, ts: new Date(Date.now() - 5 * 864e5).toISOString() },
          ambassador: isAmb ? { code: me.code, referrals: { main: me.main, competitions: me.competitions, talent: me.talent, total: me.total }, rank: 7, of: lb.length } : null,
          competitions: ["Urdu Debate", "Calligraphy"], talent: { applied: !isAmb }, stall: null,
        },
        announcements: demoAnnouncements().filter((a) => ["all", "attendees", "competitors", isAmb ? "ambassadors" : "talent"].includes(a.audience)),
        messages: demoMessages().filter((m) => m.email === (isAmb ? "ambassador@demo.pk" : "student@demo.pk")),
      };
    }
    if (action === "messages") return { demo: true, messages: demoMessages() };
    if (action === "file") { const f = demoFiles[params.id]; return f ? { ok: true, mime: f.mime, data: f.data } : { ok: false, message: "File not found." }; }
    if (action === "activity") {
      const people = [];
      lb.forEach((a, i) => {
        const seen = rnd() < 0.78, last = seen ? Date.now() - Math.pow(rnd(), 2) * 12 * 864e5 : 0;
        people.push({ email: a.name.toLowerCase().replace(/\s+/g, ".") + i + "@demo.pk", name: a.name, type: "Ambassador", code: a.code, forms: "",
          firstSeen: seen ? new Date(last - rnd() * 4 * 864e5).toISOString() : "", lastSeen: seen ? new Date(last).toISOString() : "",
          logins: seen ? 1 + Math.floor(rnd() * 6) : 0, visits: seen ? Math.floor(rnd() * 14) : 0, daysActive: seen ? 1 + Math.floor(rnd() * 7) : 0 });
      });
      for (let i = 0; i < 640; i++) {
        const nm = pick(FN) + " " + pick(LN), seen = rnd() < 0.41, last = seen ? Date.now() - Math.pow(rnd(), 1.6) * 13 * 864e5 : 0;
        people.push({ email: nm.toLowerCase().replace(/\s+/g, ".") + (i + 200) + "@demo.pk", name: nm, type: "Participant", code: "",
          forms: pick(["Main Event", "Main Event", "Main Event, Competitions", "Competitions", "Talent Award", "Main Event, Talent Award"]),
          firstSeen: seen ? new Date(last - rnd() * 3 * 864e5).toISOString() : "", lastSeen: seen ? new Date(last).toISOString() : "",
          logins: seen ? 1 + Math.floor(rnd() * 3) : 0, visits: seen ? Math.floor(rnd() * 6) : 0, daysActive: seen ? 1 + Math.floor(rnd() * 4) : 0 });
      }
      people.forEach((p) => { p.activated = p.logins > 0 || rnd() < (p.type === "Ambassador" ? 0.8 : 0.6); p.activatedAt = ""; });
      people.sort((a, b) => (b.lastSeen || "").localeCompare(a.lastSeen || "") || a.name.localeCompare(b.name));
      const since = (ms) => people.filter((p) => p.lastSeen && Date.now() - new Date(p.lastSeen) <= ms).length;
      const grp = (t) => { const g = people.filter((p) => p.type === t); return { total: g.length, loggedIn: g.filter((p) => p.lastSeen).length }; };
      const daily = Array.from({ length: 14 }, (_, k) => {
        const i = 13 - k, date = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
        const ppl = Math.round((30 + rnd() * 35) * (1.9 - i / 13));
        return { date, people: ppl, logins: Math.round(ppl * (0.45 + rnd() * 0.2)) };
      });
      return {
        demo: true, generatedAt: new Date().toISOString(),
        totals: { accounts: people.length, activated: people.filter((p) => p.activated).length, loggedIn: people.filter((p) => p.lastSeen).length, never: people.filter((p) => !p.lastSeen).length,
          active24h: since(864e5), active7d: since(7 * 864e5), logins: people.reduce((s, p) => s + p.logins, 0) },
        groups: { ambassadors: grp("Ambassador"), participants: grp("Participant") }, daily, people, mail: { quota: 87, autoAmbassadors: true, autoParticipants: true },
      };
    }
    return { demo: true };
  };
  const demoFiles = {};
  const demoAtt = (a) => { if (!a || !a.data) return null; const id = "f" + Date.now() + Math.floor(rnd() * 1e4); demoFiles[id] = { mime: a.mime, data: a.data }; return { id, kind: a.kind, mime: a.mime, duration: a.duration || 0, name: a.name || "", size: Math.round(a.data.length * 0.75) }; };
  N.demoPost = async (p) => {
    await new Promise((r) => setTimeout(r, 300));
    if (p.action === "resetRequest") return String(p.user || "").trim() ? { ok: true, demo: true, sentTo: "st•••@demo.pk" } : { ok: false, message: "Enter your username." };
    if (p.action === "resetConfirm") {
      if (String(p.code || "").length !== 6) return { ok: false, message: "That code is not correct. (Demo: any 6 digits work.)" };
      if (String(p.pass || "").length < 6) return { ok: false, message: "Use at least 6 characters for your password." };
      const user = String(p.user).trim().toLowerCase(), d = await N.demo("portal", { email: /^nea/.test(user) ? "ambassador@demo.pk" : user });
      return Object.assign(d, { token: "demo:" + d.profile.email, username: p.user });
    }
    if (p.action === "sendReminders") return { ok: true, demo: true, sent: p.channel === "portal" ? 0 : 27, posted: p.channel === "email" ? 0 : 27, left: 0 };
    if (p.action === "remindPeople") { const n = (p.emails || []).length; return { ok: true, demo: true, emailed: p.channel === "portal" ? 0 : n, posted: p.channel === "email" ? 0 : n, failed: 0, noQuota: 0 }; }
    if (p.action === "sendLogin") return { ok: true, demo: true, sent: (p.emails || []).length, failed: 0, noQuota: 0 };
    if (p.action === "changePassword") return String(p.pass || "").length < 6 ? { ok: false, message: "Use at least 6 characters for your password." } : { ok: true, demo: true, username: "NEA07" };
    if (p.action === "login") {
      const user = String(p.user || "").trim().toLowerCase();
      if (!user || !p.pass) return { ok: false, message: "Enter your username and password." };
      const d = await N.demo("portal", { email: /^nea/.test(user) ? "ambassador@demo.pk" : user });
      return Object.assign(d, { token: "demo:" + d.profile.email });
    }
    if (p.action === "sendMessage") {
      const email = String(p.token || "").replace(/^demo:/, "").toLowerCase();
      const d = await N.demo("portal", { email });
      if (!String(p.message || "").trim() && !(p.attachment && p.attachment.data)) return { ok: false, message: "Please write your message, or add a photo, voice note or file." };
      const list = [{ id: "d" + Date.now(), ts: new Date().toISOString(), email: /amb/.test(email) || !/student|guest/.test(email) ? "ambassador@demo.pk" : "student@demo.pk",
        name: d.profile.name, topic: p.topic, message: p.message, status: "Open", reply: "", repliedAt: "", attachment: demoAtt(p.attachment) }, ...demoMessages()];
      N.store.set("nuqta_demo_msg", list);
      return { ok: true, demo: true, messages: list.filter((m) => m.email === list[0].email) };
    }
    if (p.action === "replyMessage" || p.action === "messageStatus") {
      const list = demoMessages().map((m) => m.id !== p.id ? m : p.action === "replyMessage"
        ? { ...m, reply: p.reply, status: "Answered", repliedAt: new Date().toISOString(), replyAttachment: demoAtt(p.attachment) } : { ...m, status: p.status });
      N.store.set("nuqta_demo_msg", list);
      return { ok: true, demo: true, messages: list };
    }
    let list = demoAnnouncements();
    if (p.action === "announce") list = [{ id: "d" + Date.now(), ts: new Date().toISOString(), title: p.title, message: p.message, audience: p.audience, link: p.link || "", pinned: !!p.pinned }, ...list];
    if (p.action === "deleteAnnouncement") list = list.filter((a) => a.id !== p.id);
    N.store.set("nuqta_demo_ann", list);
    return { ok: true, demo: true, announcements: list };
  };

  N.AUDIENCES = {
    all: "Everyone", attendees: "Main-event attendees", ambassadors: "Campus ambassadors", competitors: "Competition participants",
    talent: "Talent award applicants", exhibitors: "Stall exhibitors",
  };
  N.audienceLabel = (a) => (a && a.startsWith("email:") ? "Personal · " + a.slice(6) : N.AUDIENCES[a] || a);

  /* ---------- UI motion ---------- */
  N.reveal = () => {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.12 });
    N.$$(".reveal").forEach((el) => io.observe(el));
  };
  N.glow = () => document.addEventListener("pointermove", (e) => {
    const c = e.target.closest && e.target.closest(".glow"); if (!c) return;
    const r = c.getBoundingClientRect(); c.style.setProperty("--mx", e.clientX - r.left + "px"); c.style.setProperty("--my", e.clientY - r.top + "px");
  });
  N.counters = () => {
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return; io.unobserve(e.target);
      const el = e.target, to = +el.dataset.count, suf = el.dataset.suffix || "", t0 = performance.now(), dur = 1600;
      const step = (t) => { const p = Math.min(1, (t - t0) / dur), v = Math.round(to * (1 - Math.pow(1 - p, 3))); el.textContent = N.fmt(v) + suf; if (p < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    }), { threshold: 0.5 });
    N.$$("[data-count]").forEach((el) => io.observe(el));
  };
  N.countdown = (el, iso) => {
    const end = new Date(iso).getTime();
    const tick = () => {
      let s = Math.max(0, Math.floor((end - Date.now()) / 1000));
      const v = [Math.floor(s / 86400), Math.floor((s % 86400) / 3600), Math.floor((s % 3600) / 60), s % 60];
      el.innerHTML = ["Days", "Hours", "Minutes", "Seconds"].map((l, i) => `<div class="cd-box"><b>${String(v[i]).padStart(2, "0")}</b><span>${l}</span></div>`).join("");
    };
    tick(); setInterval(tick, 1000);
  };
  /* "nuqta" = dot — drifting constellation of dots */
  N.dots = () => {
    const cv = N.$("#dots"); if (!cv || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = cv.getContext("2d"); let W, H, pts;
    const init = () => {
      W = cv.width = innerWidth * devicePixelRatio; H = cv.height = innerHeight * devicePixelRatio;
      cv.style.width = innerWidth + "px"; cv.style.height = innerHeight + "px";
      pts = Array.from({ length: Math.min(70, Math.floor(innerWidth / 18)) }, () => ({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25, r: (Math.random() * 1.6 + 0.4) * devicePixelRatio }));
    };
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      const link = 130 * devicePixelRatio;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i]; p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > W) p.vx *= -1; if (p.y < 0 || p.y > H) p.vy *= -1;
        for (let j = i + 1; j < pts.length; j++) {
          const q = pts[j], d = Math.hypot(p.x - q.x, p.y - q.y);
          if (d < link) { ctx.strokeStyle = `rgba(180,130,255,${0.12 * (1 - d / link)})`; ctx.lineWidth = devicePixelRatio * 0.6; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); }
        }
        ctx.fillStyle = "rgba(210,180,255,.55)"; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
      }
      requestAnimationFrame(draw);
    };
    init(); addEventListener("resize", init); draw();
  };
  N.nav = () => {
    const nav = N.$(".nav"); if (!nav) return;
    const on = () => nav.classList.toggle("scrolled", scrollY > 20); on(); addEventListener("scroll", on, { passive: true });
    const b = N.$(".burger", nav); b && b.addEventListener("click", () => nav.classList.toggle("open"));
    N.$$(".nav-links a", nav).forEach((a) => a.addEventListener("click", () => nav.classList.remove("open")));
  };
})();

/* ============ App (installable web app) ============ */
(function () {
  const N = window.Nuqta; if (!N) return;
  const path = location.pathname.replace(/^.*\//, "") || "index.html";
  N.isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  N.isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  N.isAndroid = () => /android/i.test(navigator.userAgent);
  N.isMobile = () => N.isIOS() || N.isAndroid();

  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
  }
  /* Android/Chrome install prompt: kept so the install page / banner can trigger it */
  N.installPrompt = null;
  addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); N.installPrompt = e; document.dispatchEvent(new Event("nuqta:installable")); });
  addEventListener("appinstalled", () => { N.installPrompt = null; N.store.set("nuqta_app_installed", 1); document.dispatchEvent(new Event("nuqta:installed")); });
  N.promptInstall = async () => {
    if (!N.installPrompt) return false;
    N.installPrompt.prompt();
    const r = await N.installPrompt.userChoice; N.installPrompt = null;
    return r && r.outcome === "accepted";
  };

  const ready = (fn) => (document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", fn) : fn());
  ready(() => {
    /* Inside the installed app: bottom tab bar on every page (there is no browser back button) */
    if (N.isStandalone() && path !== "dashboard.html") {
      document.body.classList.add("standalone");
      const tabs = [["app.html", "grid", "Home"], ["index.html", "star", "Event"], ["competitions.html", "trophy", "Compete"], ["portal.html", "users", "Portal"], ["faq.html", "bulb", "Help"]];
      const bar = document.createElement("nav");
      bar.className = "tabbar"; bar.setAttribute("aria-label", "App navigation");
      bar.innerHTML = tabs.map(([href, ic, label]) => `<a href="${href}" class="${href === path ? "on" : ""}">${N.icon(ic)}<span>${label}</span></a>`).join("");
      document.body.appendChild(bar);
      N.$$('a[href="index.html"].brand').forEach((a) => (a.href = "app.html"));
    }
    /* On a phone's browser (not installed yet): small "Get the app" bar, once a week at most */
    const quiet = ["install.html", "app.html", "dashboard.html"].includes(path);
    const last = Number(N.store.get("nuqta_app_nudge") || 0);
    if (!quiet && N.isMobile() && !N.isStandalone() && !N.store.get("nuqta_app_installed") && Date.now() - last > 7 * 864e5) {
      setTimeout(() => {
        const b = document.createElement("div");
        b.className = "app-nudge";
        b.innerHTML = `<img src="/assets/app/icon-192.png" alt=""><div><b>Get the Nuqta app</b><span>Updates, your portal and registrations in one tap</span></div>
          <a class="btn btn-primary btn-sm" href="install.html">Get app</a><button aria-label="Close">×</button>`;
        document.body.appendChild(b);
        requestAnimationFrame(() => b.classList.add("show"));
        N.$("button", b).addEventListener("click", () => { N.store.set("nuqta_app_nudge", Date.now()); b.remove(); });
        N.$("a", b).addEventListener("click", () => N.store.set("nuqta_app_nudge", Date.now()));
      }, 2500);
    }
  });
})();
