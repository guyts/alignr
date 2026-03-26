# alignr

A personal Invisalign treatment tracker. Track daily tray-out time, manage tray swaps, and sync your data across devices.

**Live at:** https://guyts.github.io/alignr/

---

## What it does

- **Tray-out timer** — One tap when you take your tray out, one tap when it goes back in. Tracks your daily total against the 2-hour limit and shows a bar chart of the past week.
- **Swap tracker** — 7-day tray cycle with a guided swap flow. If the new tray doesn't fit, it walks you through the wait-and-retry logic (2 days → 1 day) so you never guess.
- **Cloud sync** — Enter your email in Settings to sync your data across devices via Firebase. No password needed — same email = same data, anywhere.
- **Manual backup** — Export your data as a JSON file and import it back at any time.

---

## Tech stack

- **React 18 + Vite** — single-page app, no router
- **Inline styles** — no CSS files, all styling is JS objects
- **localStorage** — primary data store, instant and offline
- **Firebase Firestore** — cloud sync backend (see below)
- **GitHub Pages + GitHub Actions** — automated deploys on every push to `main`

---

## How cloud sync works

Cloud sync uses [Firebase Firestore](https://firebase.google.com/docs/firestore), a free NoSQL cloud database by Google.

**Why Firebase?**
- Free tier is generous (1 GB storage, 50k reads/day, 20k writes/day) — plenty for personal use
- No server to maintain
- Works directly from the browser with no backend

**How it works:**
1. You enter your email in Settings → Cloud Sync
2. The email is hashed with SHA-256 and used as a document ID in Firestore — your actual email is never stored
3. Your data syncs automatically every 5 seconds when something changes
4. On any other device, enter the same email → your data loads instantly

**Security note:** This is designed for personal use. Anyone who knows your email could theoretically access your data (there's no password). For an Invisalign tracker this is an acceptable tradeoff, but don't store anything sensitive.

---

## Local development

```bash
npm install
npm run dev
```

The app runs at `http://localhost:5173`. Cloud sync won't work locally unless you create a `.env.local` file (see below).

---

## Deploying your own copy

### 1. Fork and clone this repo

### 2. Create a Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Create a new project
3. Go to **Databases & Storage → Firestore** and create a database in **test mode**
4. Go to **Project Settings → General → Your apps** and add a **Web app**
5. Copy the config object Firebase gives you

### 3. Add GitHub secrets

Go to your repo → **Settings → Secrets and variables → Actions** and add these secrets from your Firebase config:

| Secret | Firebase config field |
|---|---|
| `VITE_FIREBASE_API_KEY` | `apiKey` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `VITE_FIREBASE_PROJECT_ID` | `projectId` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `storageBucket` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
| `VITE_FIREBASE_APP_ID` | `appId` |

### 4. Enable GitHub Pages

Go to **Settings → Pages → Source** and select **GitHub Actions**.

### 5. Push to main

The workflow in `.github/workflows/deploy.yml` builds the app and deploys it automatically. Your site will be live at `https://YOUR_USERNAME.github.io/alignr/`.

### 6. (Optional) Local Firebase config

To use cloud sync during local development, create a `.env.local` file in the project root:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

---

## License

MIT
