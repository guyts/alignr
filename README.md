# alignr 🦷

A personal Invisalign treatment tracker. Track daily tray-out time, manage tray swaps, and keep your data backed up to Google Drive.

**Live at:** `https://YOUR_USERNAME.github.io/alignr/`

## Features

- **Tray-out timer** — One-tap start/stop. Tracks daily total against the 2-hour limit.
- **Swap reminders** — Guided tray swap flow with retry logic (wait 2 days → 1 day if it doesn't fit).
- **Google Drive backup** — Auto-syncs your data so you never lose it, even across devices.
- **Manual export/import** — Download/restore your data as a JSON file.

## Quick Start

```bash
npm install
npm run dev
```

## Deploy to GitHub Pages

1. Push this repo to GitHub
2. Go to **Settings → Pages → Source** and select **GitHub Actions**
3. The workflow in `.github/workflows/deploy.yml` handles the rest
4. Your app will be live at `https://YOUR_USERNAME.github.io/alignr/`

## Setting Up Google Drive Sync (Optional)

The app works fine without this — your data is always saved locally. Google Drive sync is an extra safety net.

### 1. Create a Google Cloud Project
- Go to [Google Cloud Console](https://console.cloud.google.com/)
- Create a new project (e.g., "alignr")

### 2. Enable the Drive API
- In your project, go to **APIs & Services → Library**
- Search for "Google Drive API" and enable it

### 3. Create OAuth Credentials
- Go to **APIs & Services → Credentials**
- Click **Create Credentials → OAuth client ID**
- Application type: **Web application**
- Authorized JavaScript origins: add your GitHub Pages URL (e.g., `https://YOUR_USERNAME.github.io`)
- Also add `http://localhost:5173` for local development

### 4. Configure the Consent Screen
- Go to **OAuth consent screen**
- Add your email as a test user (while in testing mode)
- Fill in the app name ("alignr") and required fields

### 5. Add Your Client ID
- Open `src/gdrive.js`
- Replace `__GOOGLE_CLIENT_ID__` with your actual client ID
- Commit and push — the app will now show the "Connect Google Drive" option in Settings

## Tech Stack

- React 18 + Vite
- localStorage for persistence
- Google Drive API (optional) for cloud backup
- Deployed via GitHub Pages + GitHub Actions

## License

MIT
