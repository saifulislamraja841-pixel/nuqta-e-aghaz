/* Shared behaviour for every public page of the Nuqta-e-Aghaz site */
(function () {
  const N = Nuqta, C = N.C, E = C.event, $ = N.$, $$ = N.$$;
  $$(".js-date").forEach((e) => (e.textContent = E.dateLabel));
  $$(".js-time").forEach((e) => (e.textContent = E.timeLabel));
  $$(".js-venue").forEach((e) => (e.textContent = E.venue));
  $$(".js-fee").forEach((e) => (e.textContent = N.fmt(E.fee)));
  $$(".js-phone").forEach((e) => (e.textContent = C.contact.phone));
  $$(".js-wa").forEach((e) => (e.href = "https://wa.me/" + C.contact.whatsapp + "?text=" + encodeURIComponent("Assalam o Alaikum! I have a question about Nuqta-e-Aghaz.")));
  N.hydrateIcons();

  const cd = $("#countdown");
  if (cd) N.countdown(cd, E.dateISO);

  const eb = $("#earlybird");
  if (eb) {
    const ebEnd = new Date(E.earlyBirdUntil);
    if (Date.now() < ebEnd) {
      const days = Math.ceil((ebEnd - Date.now()) / 864e5);
      const price = Math.round((E.fee * (1 - E.earlyBirdPercent / 100)) / 10) * 10;
      eb.innerHTML = `Early bird: <b>${E.earlyBirdPercent}% off</b> (about PKR ${N.fmt(price)}) · ends in ${days} day${days > 1 ? "s" : ""}, on 20 November`;
    } else eb.textContent = "Refreshments included · limited seats";
  }

  const ref = N.getRef();
  const rb = $("#refBanner");
  if (ref && rb && new URLSearchParams(location.search).get("ref")) {
    $("#refCode").textContent = ref; rb.classList.add("show"); setTimeout(() => rb.classList.remove("show"), 7000);
  }

  const mq = $("#marquee");
  if (mq) {
    const sponsors = ["Alkhidmat Foundation", "Helping Hand", "Meezab Group", "Nayatel", "Ahbab Publications", "AFAQ", "Sufi Group", "Cakes & Bakes", "Shergar", "Dunya Consultants", "Paragon Overseas Education"];
    mq.innerHTML = [...sponsors, ...sponsors].map((s) => `<span>${N.esc(s)}</span><span style="color:var(--violet)">•</span>`).join("");
  }

  const gl = $("#guestList");
  if (gl) {
    const guests = [["Ahsan Iqbal", "Federal Minister"], ["Ahmad Bilal", "President PILDAT"], ["Eng. Haider Ali", "President PEF Pakistan"],
      ["Wahaj Siraj", "CEO Nayatel"], ["Tabish Hashmi", "TV Show Host"], ["Abbas Tabish", "Renowned Poet"], ["Iftikhar Thakur", "Comedian"],
      ["Hammad Rasheed", "President AKFP Lahore"], ["Rehan Tariq", "Journalist"], ["Qasim Ali Shah", "Motivational Speaker"], ["Hisham Sarwar", "Tech Enthusiast"]];
    gl.innerHTML = guests.map((g, i) => {
      const ini = g[0].replace("Eng. ", "").split(" ").map((w) => w[0]).join("").slice(0, 2);
      return `<div class="card glow guest reveal d${(i % 4) + 1}"><div class="mono"><i>${ini}</i></div><div><b>${N.esc(g[0])}</b><span>${N.esc(g[1])}</span></div></div>`;
    }).join("");
  }

  const s = C.contact;
  const socialHtml = [["fb", s.facebook, "Facebook"], ["ig", s.instagram, "Instagram"], ["li", s.linkedin, "LinkedIn"], ["whatsapp", "https://wa.me/" + s.whatsapp, "WhatsApp"]]
    .filter((x) => x[1]).map((x) => `<a href="${x[1]}" target="_blank" rel="noopener" aria-label="${x[2]}">${N.icon(x[0])}</a>`).join("");
  $$("#socials, .js-socials").forEach((el) => (el.innerHTML = socialHtml));

  N.nav(); N.reveal(); N.glow(); N.counters(); N.dots();
})();
