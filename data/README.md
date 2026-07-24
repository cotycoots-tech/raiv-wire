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
5. Click **Test connection**, then **Save settings**.
6. Use **Save** on the toolbar to push updates.

The token is stored only in your browser (`localStorage`). It is never written into these data files.

## Restore

Use **Import** in the app, or copy values from these JSON files into Import / catalog import.
