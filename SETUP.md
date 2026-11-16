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
3. Run `setup` once and allow the permissions. It creates the **Ambassador Codes** tab (Email · Name · Code · Status), gives every ambassador a code in sign-up order (`NEA01`, `NEA02` …) and installs a trigger on each form.
   - Change a code in that tab to override it; write `rejected` in Status to remove someone.
   - Run `emailExistingAmbassadors` once if you want everyone emailed their code and link.
4. **Deploy → New deployment → Web app** · Execute as **Me** · Access **Anyone** → copy the `/exec` URL.

## 2. Site
Paste the `/exec` URL into `scriptUrl` in `config.js`, commit and push. The VPS pulls from GitHub.

## Privacy
- Ambassador names and referral counts are **not shown publicly**. Each ambassador sees only their own code, link, counts and rank in **My Portal** (email + last 4 digits of their WhatsApp number).
- The full leaderboard is only in the team dashboard (admin key).
- `.git`, `apps-script/` and `*.md` are blocked by the web server.
