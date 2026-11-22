/* =====================================================================
   NUQTA-E-AGHAZ — SITE CONFIGURATION
   This is the ONLY file you need to edit to connect your Google Forms
   and your Google Apps Script backend. See SETUP.md for step-by-step help.
   ===================================================================== */
window.NUQTA_CONFIG = {
  event: {
    name: "Nuqta-e-Aghaz",
    dateISO: "2026-12-05T10:00:00+05:00",       // used for the countdown
    dateLabel: "05 December 2026",
    timeLabel: "10:00 AM – 5:00 PM",
    venue: "Faletti's Hotel, Lahore",
    fee: 1500,                                  // PKR
    earlyBirdPercent: 33,
    earlyBirdUntil: "2026-11-20T23:59:00+05:00",
    stallDeadline: "2026-11-30T23:59:00+05:00",
  },

  contact: {
    phone: "0348 4243350",
    whatsapp: "923484243350",                   // international format, no +
    email: "",                                  // e.g. "sponsors@nuqtaeaghaz.com" (optional)
    instagram: "https://instagram.com/nuqta_e_aghaz",
    facebook: "https://facebook.com/nuqta_e_aghaz",
    linkedin: "https://linkedin.com/company/nuqta_e_aghaz",
  },

  /* Mobile app (installable web app). Share www.nuqtaeaghaz.org/install.html on WhatsApp.
     apkUrl → optional Android APK file (e.g. built free at pwabuilder.com), e.g. "/downloads/nuqta.apk".
              Leave "" to only offer the normal install (works on Android and iPhone). */
  app: { apkUrl: "/downloads/nuqta-e-aghaz.apk" },

  /* Google Apps Script Web App URL (ends with /exec).
     Leave empty "" to run the dashboard & portal on DEMO data. */
  scriptUrl: "https://script.google.com/macros/s/AKfycbxcFtZMK9XC2A7nJE0R0gqMUjWKIjscb17Fo2s2ydkiAeID5Dy8izk6-ZKnr0EW3b_S5w/exec",

  /* Your Google Forms.
     url      → the form's normal link (…/viewform)
     refEntry → the pre-fill id of the "Ambassador / Referral Code" question,
                e.g. "entry.1234567890". Leave "" if that form has no such question.
     newTab   → true opens the form in a new tab instead of the pop-up
                (needed for forms with file uploads, which Google won't show inside other sites). */
  forms: {
    main:        { title: "Fiesta Registration (Main Event)",
                   url: "https://docs.google.com/forms/d/e/1FAIpQLScy08HXEK8w1wd0Htvarmhno6G_QZsC73XYX4LAVNF6n2bAWA/viewform", refEntry: "entry.28514730",
                   newTab: true },   // has a file upload → Google only allows it in its own tab
    ambassador:  { title: "UET Ambassador Registration",
                   url: "https://docs.google.com/forms/d/e/1FAIpQLSe7JI-9uPDNm9J8Ld0EU9vb_Ue9FkkMP9RTFNWK_O8qOEEE9g/viewform", refEntry: "" },
    competitions:{ title: "Competitions Registration",
                   url: "https://docs.google.com/forms/d/e/1FAIpQLSd3re2BCc5EVtDaGyF-YU_rCcMvQ_nj7Zrxm9_GZuR_YsIsgQ/viewform", refEntry: "entry.1048051579" },
    talent:      { title: "UET Talent Award 2026",
                   url: "https://docs.google.com/forms/d/e/1FAIpQLSdIRaasilex_te8rO2ic9nO3je1uD41jpbV3U9Z_ggqW1bzPQ/viewform", refEntry: "entry.324524728",
                   newTab: true },   // has a file upload → Google only allows it in its own tab
    stall:       { title: "Stall Booking",
                   url: "https://docs.google.com/forms/d/e/1FAIpQLSeNXW-og9fJLNNy-UM8r_fWRZ6pecjTHv8gBMQ24ceR_jftkA/viewform", refEntry: "" },
    sponsor:     { title: "Sponsorship Enquiry",
                   url: "https://docs.google.com/forms/d/e/1FAIpQLScOxA7zWECvimM2URMZMEF70nji6wnQKbbPGtwF1tVUzVeNjA/viewform", refEntry: "" },
  },
};
