# Nuqta-e-Aghaz — connecting the Google Forms

The site uses your **existing** Google Forms. Nothing new is created, and all old responses are kept and shown in the dashboard and portal.

| Form | Edit link id | On the site |
|---|---|---|
| UET Ambassador Registration | `1Bqs-XiIk80YuAV51vBtzQQLhhdT5dsLZ6K_C72IHBoY` | Ambassadors page → "Register as Ambassador" |
| Competitions Form | `15u_eCT5mSdqM9g7YgKIjjf2ZcmDlgMiEm45PQS2LpZo` | Competitions page → "Register for Competitions" (ambassador code is pre-filled from referral links) |

Main Event, Talent Award, Stall and Sponsor buttons show "Registration opens shortly" until you add their form links in `config.js`.

## 1. One spreadsheet for both forms (needs edit access to the forms)
1. Open the **Ambassador** form → **Responses** → **Link to Sheets** → **Create a new spreadsheet**. Name it `Nuqta-e-Aghaz Master`.
2. Open the **Competitions** form → **Responses** → **Link to Sheets** → **Select existing spreadsheet** → `Nuqta-e-Aghaz Master`.
   Google copies **all previous responses** into the sheet, so old registrations are included.

## 2. Backend (Apps Script)
1. In the spreadsheet: **Extensions → Apps Script**. Replace everything in `Code.gs` with `apps-script/Code.gs` from this repo.
2. At the top, set `ADMIN_KEY` to a long password of your own (the dashboard stays locked while it is the placeholder).
3. Select `setup` → **Run** → allow the permissions. It renames the two response tabs to `Ambassadors` and `Competitions`, gives every ambassador a code (`NEA01`, `NEA02` …) in an **Ambassador Code** column, and installs the trigger that codes and emails new ambassadors.
   - If you already gave ambassadors codes, type them in the **Ambassador Code** column first; `setup` only fills empty cells.
   - To email every existing ambassador their code and link, run `emailExistingAmbassadors` once.
4. **Deploy → New deployment → Web app** · Execute as **Me** · Who has access **Anyone** → copy the URL ending in `/exec`.

## 3. Site
Paste the `/exec` URL into `scriptUrl` in `config.js`, commit and push. The VPS pulls from GitHub.

## Privacy
- Ambassador names and referral counts are **not shown publicly**. Each ambassador sees only their own code, link, counts and rank in **My Portal** (email + last 4 digits of their WhatsApp number).
- The full leaderboard is only in the team dashboard (admin key).
- `.git`, `apps-script/` and `*.md` are blocked by the web server.
