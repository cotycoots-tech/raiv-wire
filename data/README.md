# RAIV Wire data (GitHub sync)

Files in this folder are written when you click **Save** on the site with GitHub connected.

| File | Contents |
|------|----------|
| `projects-library.json` | All projects (multi-project library) |
| `device-catalog.json` | Device inventory catalog |
| `active-project.json` | Snapshot of the project that was active at save time |

## Connect GitHub from the app

1. Open the live site or local app.
2. Click **GitHub** (settings).
3. Create a [Personal Access Token](https://github.com/settings/tokens) with **Contents: Read and write** on this repository.
4. Enter owner (`cotycoots-tech`), repo (`raiv-wire`), branch (`main`), and the token.
5. Enable **Auto-push on Save** and **Auto-pull on page load**.
6. Click **Test connection**, then **Save settings**.
7. **Save** = push this browser’s projects to GitHub.  
   **Pull** = download projects from GitHub into this browser.

The token is stored only in your browser (`localStorage`). It is never written into these data files.

### Cross-browser / multi-machine

Projects do **not** appear on another PC until you **Pull** (or enable auto-pull on load).  
Always **Save** after editing, then **Pull** (or reopen the app with auto-pull) on the other machine.

## Restore

### On the live site (recommended)

1. Hard-refresh the page (`Cmd+Shift+R`).
2. Click **Factory restore** — reloads `data/factory-recovery.json` (Demo Build + full 19-device catalog).
3. Or click **Recover components** for catalog only.
4. Click **Save** (with GitHub connected) so all PCs can **Pull** the recovered data.

### Manual

Use toolbar **Pull**, or **Import** JSON, or copy values from these files into Import / catalog import.

### Files

| File | Purpose |
|------|---------|
| `factory-recovery.json` | Full recovery bundle used by **Factory restore** |
| `projects-library.json` | Multi-project library |
| `device-catalog.json` | Device inventory |
| `active-project.json` | Last active project snapshot |
