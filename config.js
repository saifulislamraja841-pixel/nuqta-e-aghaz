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

  /* Google Apps Script Web App URL (ends with /exec).
     Leave empty "" to run the dashboard & portal on DEMO data. */
  scriptUrl: "",

  /* Your Google Forms.
     url      → the form's normal link (…/viewform)
     refEntry → the pre-fill id of the "Ambassador / Referral Code" question,
                e.g. "entry.1234567890". Leave "" if that form has no such question. */
  forms: {
    main:        { title: "Main Event Registration",     url: "", refEntry: "" },
    ambassador:  { title: "Campus Ambassador Application", url: "", refEntry: "" },
    competitions:{ title: "Competition Registration",    url: "", refEntry: "" },
    talent:      { title: "Talent Award Application",    url: "", refEntry: "" },
    stall:       { title: "Stall Booking",               url: "", refEntry: "" },
    sponsor:     { title: "Sponsorship Enquiry",         url: "", refEntry: "" },
  },
};
