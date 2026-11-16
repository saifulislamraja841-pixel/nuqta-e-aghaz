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
    grid: '<rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/>',
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
      const email = (params.email || "").toLowerCase();
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
      };
    }
    return { demo: true };
  };
  N.demoPost = async (p) => {
    await new Promise((r) => setTimeout(r, 300));
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
