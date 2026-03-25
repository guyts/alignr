/**
 * Google Drive sync for alignr.
 *
 * HOW IT WORKS:
 * 1. User clicks "Connect Google Drive" → OAuth popup with Google Identity Services
 * 2. We create/update a single JSON file called "alignr-backup.json" in their Drive
 * 3. On load, if connected, we check Drive for a newer backup and offer to restore
 * 4. On every state change, we debounce-save to Drive (max once per 30s)
 *
 * SETUP: You need a Google Cloud project with the Drive API enabled and an OAuth
 * client ID. Set it in the GOOGLE_CLIENT_ID constant below.
 */

const GOOGLE_CLIENT_ID = '__GOOGLE_CLIENT_ID__'; // Replace with your OAuth client ID
const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const BACKUP_FILENAME = 'alignr-backup.json';
const SYNC_DEBOUNCE_MS = 30000;

let accessToken = null;
let syncTimeout = null;
let gsiLoaded = false;

// ---- Google Identity Services loader ----
function loadGsi() {
  return new Promise((resolve, reject) => {
    if (gsiLoaded) return resolve();
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.onload = () => { gsiLoaded = true; resolve(); };
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(script);
  });
}

// ---- Auth ----
export async function signIn() {
  await loadGsi();
  return new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPES,
      callback: (response) => {
        if (response.error) return reject(new Error(response.error));
        accessToken = response.access_token;
        localStorage.setItem('alignr-gdrive-token', accessToken);
        resolve(accessToken);
      },
    });
    client.requestAccessToken();
  });
}

export function getStoredToken() {
  accessToken = localStorage.getItem('alignr-gdrive-token');
  return accessToken;
}

export function signOut() {
  accessToken = null;
  localStorage.removeItem('alignr-gdrive-token');
}

export function isConnected() {
  return !!getStoredToken();
}

// ---- Drive API helpers ----
async function driveRequest(url, options = {}) {
  if (!accessToken) throw new Error('Not authenticated');
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...options.headers,
    },
  });
  if (res.status === 401) {
    // Token expired
    signOut();
    throw new Error('Token expired — please reconnect Google Drive');
  }
  return res;
}

async function findBackupFileId() {
  const q = encodeURIComponent(`name='${BACKUP_FILENAME}' and trashed=false`);
  const res = await driveRequest(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,modifiedTime)`);
  const data = await res.json();
  if (data.files && data.files.length > 0) {
    return { id: data.files[0].id, modifiedTime: data.files[0].modifiedTime };
  }
  return null;
}

// ---- Public API ----

/** Download the backup from Drive. Returns { state, modifiedTime } or null. */
export async function downloadBackup() {
  try {
    const file = await findBackupFileId();
    if (!file) return null;
    const res = await driveRequest(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`);
    const state = await res.json();
    return { state, modifiedTime: file.modifiedTime };
  } catch (e) {
    console.warn('Drive download failed:', e);
    return null;
  }
}

/** Upload the current state to Drive. */
export async function uploadBackup(state) {
  try {
    const file = await findBackupFileId();
    const body = JSON.stringify(state);

    if (file) {
      // Update existing file
      await driveRequest(`https://www.googleapis.com/upload/drive/v3/files/${file.id}?uploadType=media`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
    } else {
      // Create new file with multipart upload
      const metadata = { name: BACKUP_FILENAME, mimeType: 'application/json' };
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', new Blob([body], { type: 'application/json' }));
      await driveRequest('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        body: form,
      });
    }
    return true;
  } catch (e) {
    console.warn('Drive upload failed:', e);
    return false;
  }
}

/** Debounced sync — call this on every state change. */
export function scheduleDriveSync(state) {
  if (!isConnected()) return;
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(() => uploadBackup(state), SYNC_DEBOUNCE_MS);
}

/** Force an immediate sync (e.g. on tray swap). */
export async function forceDriveSync(state) {
  if (!isConnected()) return false;
  if (syncTimeout) clearTimeout(syncTimeout);
  return uploadBackup(state);
}

export function isConfigured() {
  return GOOGLE_CLIENT_ID !== '__GOOGLE_CLIENT_ID__';
}
