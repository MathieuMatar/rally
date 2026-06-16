# Guide — "Live It" Rally App (Béatitudes Ados)

This guide explains how to use the app on the day of the rally. No technical knowledge needed.

There are **two separate things**:

1. **Team App** — an Android app installed on one phone per team. The kids use this.
2. **HQ Dashboard** — a website that organizers/staff use on a laptop or phone browser to watch
   everything live.

---

## 1. The Team App (on each team's phone)

### Installing it
- You'll receive one file: `app-release.apk`.
- Send it to each team's phone (WhatsApp, email, USB, Google Drive — any way works).
- On the phone, open the file. Android will warn "this app isn't from the Play Store" —
  choose **Install anyway / Allow** (sometimes called "install unknown apps").
- Do this once per phone, before the event.

### Logging in (must be done with internet/data ON)
- Open the app.
- Enter the team's code (see table below) and tap **Start**.
- This downloads that team's full route, clues, and station map onto the phone.
- **Important:** after this first login, the phone needs **no internet** to play —
  everything needed for the game is now stored on the phone. Internet is only needed
  again so the phone can report progress back to HQ (it will do this automatically
  whenever it has signal).

### Team Codes

| Team | Code |
|------|------|
| red A | `REDA-2026` |
| blue A | `BLUEA-2026` |
| green A | `GREENA-2026` |
| yellow A | `YELLOWA-2026` |
| red B | `REDB-2026` |
| blue B | `BLUEB-2026` |
| green B | `GREENB-2026` |
| yellow B | `YELLOWB-2026` |

> Codes are typed in capitals automatically. Make sure the hyphen (`-`) and `2026` are included
> exactly as shown. If a code doesn't work, double-check it's typed exactly like the table —
> a typo is the most common cause of "Invalid team code".

### What the app does during the rally
- **Clue screen** — shows the riddle/clue for the team's *next* station, plus the overall
  countdown timer, current score, and how many "help hints" are left.
- **Scan to start** — at each station, the team scans the **START** QR code sign. This starts
  that station's timer and unlocks the challenge. Scanning the wrong station's code will be
  refused with a message.
- **Challenge screen** — shows what to do at this station, a running timer, and buttons to
  take photos/videos for that challenge.
- **Scan to finish** — when done, the team scans the **END** QR code. This locks in their time,
  reveals the *next* clue, and moves them to the next station.
- **Photos & Video** — the team can take pictures/short videos at each station as proof or for
  fun. These stay on the phone only — they are **not** sent anywhere during the event. They get
  collected from the phones afterwards (see the technical README for how).
- **Map** — shows the team's own progress: the stations they've already visited and the path
  between them, plus their live position. It does **not** show the location of stations they
  haven't reached yet (that would spoil the clue).
- **"I'm stuck" button** — sends a request to HQ that the team needs a hint. An organizer at HQ
  can then grant a hint, which lowers the team's "help hints remaining" count (each team starts
  with a limited number — see Event Settings below).
- **Call HQ / Call Emergency buttons** — these make a real phone call (using the phone's normal
  signal, not internet) to the HQ phone number or emergency number.
- **SOS button** — sends an emergency alert with the team's current location straight to the
  HQ dashboard, in addition to placing the emergency call.
- **Leaving the app** — if a team minimizes/leaves the app for more than a couple of seconds
  (not counting when they use the Call buttons), this is logged and shown to organizers. There's
  no automatic penalty — it's just information for organizers to use their judgment.

---

## 2. The HQ Dashboard (for organizers/staff)

### Accessing it
- Open a web browser (laptop, tablet, or phone) and go to the event's web address:
  **https://r.vibrandstudio.com**
- Enter the **organizer code** or **admin code** (see below) and click **Log in**.

### Codes
- **Organizer code:** `ORGANIZER-2026`
- **Admin code:** `ADMIN-2026`

> Both codes currently give the same dashboard access. These are the default codes from setup —
> ask the developer if they were changed for this event.

### What you can do on the dashboard
- **Live scoreboard** — all 8 teams ranked by score, updating in real time.
- **Live map** — every team's current position (color-coded), plus their trail of completed
  stations. Updates automatically as teams move and finish stations.
- **Team details** — click any team to see:
  - Time spent at each station so far
  - How many times they've left the app, and for how long
  - Their current target station
- **Adjust scores** — if a challenge is judged by a human (e.g., a performance or taste test),
  you can set or change the points a team earned for that station.
- **Grant a help hint** — when a team radios in saying they're stuck, click "Give hint" for that
  team. This lowers their remaining hint count (shown on their phone) and is how the limited
  "help" pool is tracked. The actual help/clue is given over the phone call — this button is
  just for tracking the credit.
- **Broadcast a message** — send a text message/banner to one team or to all teams at once
  (e.g., "10 minutes left!" or "Station 5 is closed, skip to the next").
- **Override a clue** — if a team is completely lost or stuck, you can manually push them a
  replacement clue for their current station.
- **Alerts** — SOS alerts and "stuck" requests show up here. Mark them resolved once handled.
- **Export results** — download a spreadsheet (CSV) of every team's final scores and per-station
  times, for prizes/records after the event.

---

## 3. Event Settings (ask the developer to change these before the day)

These values control the whole event and are set in one file (`seed_data.json`) before the
event starts:

- **Event date & start time**
- **Total duration** (how long the rally runs)
- **HQ phone number** and **emergency phone number** (used by the Call buttons)
- **Number of help hints per team** (currently 3 each)
- **Team routes** — each team's fixed order of 11 stations (already set, don't change unless
  you want to redesign the rally)
- **Station clues, names, and coordinates**

If anything needs to change (phone numbers, start time, a clue's wording, etc.), send the
updated details to whoever maintains the app — it's a single file to edit and re-deploy.

---

## 4. Quick Troubleshooting

- **"Invalid team code" / "Invalid organizer code"** — re-check the exact code against the
  tables above (capital letters, hyphen, `2026`).
- **App won't log in** — make sure the phone has mobile data or Wi-Fi turned on for this
  one-time step. Once logged in, the game works without internet.
- **A team's phone died / was replaced** — log into the new phone with the same team code.
  It will re-download that team's route. (Note: any locally-saved photos/videos and progress
  on the old phone won't transfer — only the route/clues come from the server.)
- **Dashboard shows a team as "offline" / not moving** — that just means their phone currently
  has no signal. Their progress will sync and appear as soon as they get signal again; nothing
  is lost.
- **A team scans the wrong QR code** — the app will refuse it and tell them it's not their next
  station. They just need to find the correct one.
