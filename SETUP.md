# Nuqta-e-Aghaz — connecting the Google Forms

The site uses your **existing** Google Forms. Nothing new is created, and all old responses are kept and shown in the dashboard and portal.

| Form | Edit link id | On the site |
|---|---|---|
| UET Ambassador Registration | `1Bqs-XiIk80YuAV51vBtzQQLhhdT5dsLZ6K_C72IHBoY` | Ambassadors page → "Register as Ambassador" |
| Competitions Form | `15u_eCT5mSdqM9g7YgKIjjf2ZcmDlgMiEm45PQS2LpZo` | Competitions page → "Register for Competitions" |
| Fiesta (Participants) Registration | `1kJBEDmjI8OOd1b74eWh59VjPNrvVxfPeLBrMFS-tBLA` | Every "Register" button (main event) |
| UET Talent Award 2026 | `1i0rWdSEtUtZt5hvKyZlXgEgXs21JVNTjF7j5u128geI` | Talent Award page → "Apply" |

The ambassador code is pre-filled in the Competitions, Fiesta and Talent forms when a student arrives through a referral link. Stall and Sponsor buttons show "Registration opens shortly" until you add their form links in `config.js`.

## 1. Backend (Apps Script)
Responses are read **directly from the 4 forms** (all old and new responses), so the forms' existing response sheets are left untouched. The account running the script must be an **editor** of all 4 forms.
1. Create a new Google Sheet (e.g. `Nuqta-e-Aghaz Data`) → **Extensions → Apps Script**. Replace `Code.gs` with `apps-script/Code.gs`.
2. Set `ADMIN_KEY` at the top to a long password (the dashboard stays locked while it is the placeholder).
3. Run `setup` once and allow the permissions. It installs the triggers and prepares the **Ambassador form's response sheet**:
   - **Reference Number** (column B): numbers you typed by hand are kept. Any row without one gets the next number after the highest (`NEA40` → `NEA41` …). Numbers are never reused.
   - **Portal Password**, **Login Sent**, **Status** are added at the end. Username = reference number.
   - A repeat sign-up (same email, WhatsApp number or UET registration number as an earlier row) gets no new number; Status says `Duplicate of NEAxx`.
   - Write `rejected` in Status to remove someone. Clear **Login Sent** to email someone their login again.
   - From then on, each new ambassador is emailed their reference number, username, password and portal link within a minute. Duplicates are emailed their existing details.
   - Run `emailLoginsToExistingAmbassadors` once to email everyone who signed up before setup. Gmail allows about 100 emails a day; run it again the next day if it stops.
4. **Deploy → New deployment → Web app** · Execute as **Me** · Access **Anyone** → copy the `/exec` URL.

## 2. Site
Paste the `/exec` URL into `scriptUrl` in `config.js`, commit and push. The VPS pulls from GitHub.

## 3. Messages and portal activity
Two new tabs are created in the data spreadsheet when the updated script first runs:

- **Messages**: questions people send from **My Portal → Ask the team**. Answer them in **Dashboard → Messages**. Everything stays in the portal: the reply appears in their portal, and no email is sent (set `EMAIL_REPLIES = true` if you ever want replies emailed too). You can also type a reply straight into the **Reply** column. Status is `Open`, `Answered` or `Closed`. Each person can send at most 5 messages an hour.
- **WhatsApp alert on the official number**: every new portal message is sent as a WhatsApp message to `WHATSAPP_ALERT_NUMBER` (0348 4243350) through the free CallMeBot API. One-time setup, done on the phone that has the official WhatsApp:
  1. Open the CallMeBot WhatsApp page (https://www.callmebot.com/blog/free-api-whatsapp-messages/), save the bot's number shown there in the phone's contacts.
  2. From the official WhatsApp, send the bot: `I allow callmebot to send me messages`
  3. The bot replies with an API key. Paste it into `WHATSAPP_APIKEY` at the top of `Code.gs` **in the Apps Script editor only** (don't put it on GitHub), then Save.
  4. Select `testWhatsAppAlert` and click **Run**. Google asks once for permission to "connect to an external service": allow it. A test message should arrive on the official number.
  If the key doesn't arrive within 2 minutes, try again after 24 hours. Leaving `WHATSAPP_APIKEY` empty turns alerts off; the dashboard inbox always shows every message.
- **Portal Activity**: one row for each sign-in (`login`) and for each return visit while still signed in (`visit`, counted at most once every 30 minutes per person). **Dashboard → Portal activity** turns this into the report: accounts, who has logged in, who never has, active today and this week, people per day, and a searchable list you can export to CSV, e.g. to send a reminder to everyone who never logged in.

Activity is only recorded from the moment the updated script is deployed. Earlier logins were not tracked.

**Updating the script:** paste the new `Code.gs` but **keep your own `ADMIN_KEY` line**. Save (no need to run `setup` again; the new tabs create themselves), then **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy**. The `/exec` URL stays the same.

## 4. Mobile app (Android + iPhone, no app store)
The site is also an installable app. **Share this link on WhatsApp: `https://www.nuqtaeaghaz.org/install.html`**. The page shows each phone its own steps:
- **Android (Chrome):** an "Install the app" button, or ⋮ → *Install app*. It appears in the app drawer like any other app.
- **iPhone (Safari):** Share → *Add to Home Screen*. Apple does not allow installing apps from a file, so this is the only way without the App Store.

Inside the app: its own home screen (`app.html`) with countdown, portal status, quick actions and announcements; a bottom tab bar on every page; people stay signed in to the portal for 14 days; recent screens open offline.

Files: `manifest.webmanifest` (name, icons), `sw.js` (offline cache; change `VERSION` in it after big updates), `app.html`, `install.html`, `offline.html`, `assets/mobile.css`, `assets/app/` (icons). The site must be on **https** for installing to work.

**Optional Android APK file** (for people who'd rather install a file): once the site is live, go to **pwabuilder.com**, enter `https://www.nuqtaeaghaz.org/app.html`, choose **Android → Generate package** and download the zip. Upload the `.apk` from it to the server (e.g. `/downloads/nuqta.apk`) and set `app.apkUrl` in `config.js`. The install page then shows a "Download the APK file" button. Android will ask people to allow installing from their browser or WhatsApp the first time.

## Privacy
- Ambassador names and referral counts are **not shown publicly**. Each ambassador sees only their own code, link, counts and rank in **My Portal** (reference number + password; other attendees use email + last 4 digits of their phone).
- The full leaderboard is only in the team dashboard (admin key).
- `.git`, `apps-script/` and `*.md` are blocked by the web server.
