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

## Privacy
- Ambassador names and referral counts are **not shown publicly**. Each ambassador sees only their own code, link, counts and rank in **My Portal** (reference number + password; other attendees use email + last 4 digits of their phone).
- The full leaderboard is only in the team dashboard (admin key).
- `.git`, `apps-script/` and `*.md` are blocked by the web server.
