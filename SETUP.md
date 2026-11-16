# Nuqta-e-Aghaz website: setup guide

The site runs in **demo mode** (sample numbers) until you finish steps 1–4. You only edit two files: `config.js` and `apps-script/Code.gs`.

```
index.html        Public marketing site (students + sponsors)
portal.html       My Portal: attendees, competitors, talent applicants, ambassadors
dashboard.html    Team dashboard (admin key protected)
config.js         ← your form links + backend URL
apps-script/Code.gs  ← backend that reads your Google Sheets
assets/           styles, scripts, logo, floor plan, proposal PDF
```

---

## 1. Prepare your Google Forms

Every form should ask for these (any wording works, the script detects them):

| Question | Needed for |
|---|---|
| **Full Name** | dashboard + portal |
| **Email** (or turn on *Settings → Collect email addresses*) | portal login, cross-form matching |
| **Phone / WhatsApp number** | portal login (last 4 digits) |
| **University** | university chart |

Extra questions:

- **Main Event, Competitions, Talent Award:** add a short-answer question titled **"Ambassador / Referral Code (optional)"**.
- **Competitions:** one *checkbox* question titled **"Competition"** with options Qirat, Naat, Debate, Calligraphy, Painting.
- **Ambassador form:** nothing extra. The script adds an "Ambassador Code" column (NA-001, NA-002, …) by itself.

## 2. Send all forms to ONE spreadsheet

For each form: **Responses → Link to Sheets → Select existing spreadsheet** → choose the same master spreadsheet.
Then rename the tabs exactly:

`Main Event` · `Ambassadors` · `Competitions` · `Talent Award` · `Stalls`

(Or keep your names and edit `TABS` at the top of `Code.gs`.)

## 3. Install the backend (Apps Script)

1. In the master spreadsheet: **Extensions → Apps Script**.
2. Delete what's there, paste the whole of `apps-script/Code.gs`.
3. At the top, set `ADMIN_KEY` (a long password for your team) and `SITE_URL` (where you host the site, ending in `/`).
4. Choose the function **`setup`** in the toolbar and click **Run**. Approve the permissions. This creates the `Announcements` tab, gives ambassadors their codes, and installs the form-submit trigger. New ambassadors get their code + referral link by email automatically.
5. **Deploy → New deployment → type: Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Copy the Web app URL (ends with `/exec`).

> If you edit `Code.gs` later: **Deploy → Manage deployments → ✏️ → Version: New version → Deploy**. The URL stays the same.

## 4. Fill in `config.js`

```js
scriptUrl: "https://script.google.com/macros/s/XXXX/exec",
forms: {
  main: { title: "Main Event Registration", url: "https://docs.google.com/forms/d/e/…/viewform", refEntry: "entry.123456789" },
  …
}
```

**Finding `refEntry`** (so ambassador codes fill themselves in):
open the form editor → ⋮ menu → **Get pre-filled link** → type `TEST` in the referral question → **Get link** → copy it.
The link contains something like `entry.123456789=TEST`. Put `entry.123456789` in `refEntry`.

Leave `refEntry: ""` for forms without a referral question (ambassador, stall, sponsor).

## 5. Publish the site

Upload the whole folder to your hosting (cPanel `public_html`, Netlify, Vercel or GitHub Pages). It's plain HTML/CSS/JS, so there's nothing to build.

---

## How the pieces work

**Ambassador referrals.** Each ambassador shares `yoursite.com/index.html?ref=NA-024` (copy it from My Portal). The visitor's browser stores the code for 30 days and pre-fills it into every form they open. Codes typed by hand also count (`na24`, `NA-24` and `NA024` all match NA-024).

**Dashboard.** Shows totals for each category, registrations through ambassadors, competition entries, and how many from each group also registered for the main event (matched by email). It also has a sortable/exportable leaderboard and refreshes every 60 seconds.

**Portal + announcements.** Write an announcement in Dashboard → Announcements and choose the audience: everyone, attendees, ambassadors, competitors, talent applicants, exhibitors, or **one person by email**. It appears in those people's portal right away. Announcements are stored in the `Announcements` tab, so you can also edit them there.

**Reject an ambassador / entry.** Add a column titled `Status` to that tab and type `Rejected`. The row is then ignored everywhere.

## Security notes

- The admin key lives only in `Code.gs` (server side). It is never in the website files.
- Portal sign-in is email + last 4 phone digits. That's fine for event updates, but don't post private information in announcements.
- The public leaderboard on the homepage shows first name + last initial only.

## Things to double-check before launch

- **Event time differs across your posters:** 10 AM–3 PM (main poster, stall poster), 10 AM–5 PM (registration posters), 10 AM–2 PM (talent award). The site uses 10:00 AM – 5:00 PM. Change `timeLabel` in `config.js` if needed.
- Venue spelling: the posters say "Flatties" / "Flattie's". The site uses **Faletti's Hotel, Lahore**.
- Poster typos: "PIANTING" → Painting, "SPONCERED" → Sponsored.
