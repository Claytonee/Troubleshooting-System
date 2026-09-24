# Backup and recovery

Adopted 2026-09-24 (DECISIONS.md D18). NIST CSF 2.0 *Recover*.

## Targets

| | Target | Meaning |
|---|---|---|
| **RPO** | 24 hours | At most one day of reports, updates and changes may be lost |
| **RTO** | 4 hours | The service is back within four hours of the decision to restore |

These are targets, not measurements, until the first production drill has run.

## What exists

- **Code:** GitHub (`origin`), with the GitLab mirror and every developer's clone. Recovering the
  code is `git clone` plus the deploy steps in `deploy/`.
- **Secrets:** only in the hosting panel. They are **not** in any backup this project controls.
  Keep an offline record of *which* variables exist (the list is in CLAUDE.md), never their values.
- **Database:** the hosting account's backups (cPanel/DirectAdmin: JetBackup or the account backup).
  **Schedule and retention are unverified.** The owner confirms both with the host and writes them here.
- **Uploaded files:** Cloudinary. Their durability is Cloudinary's; database rows point at their URLs.

## The monthly drill

A backup is proven by restoring it. On a workstation, never on the live server:

1. In cPanel, download the latest MySQL backup of the database (a `.sql` or `.sql.gz`; unzip it).
2. Run:
   ```bash
   cd backend
   node scripts/verify-backup-restore.js path/to/backup.sql
   ```
   It restores into a scratch database (`<DB_NAME>_restore_check`) and checks:
   - the restore ran without errors;
   - the core tables are present;
   - there is an active platform admin;
   - no orphaned rows;
   - every password is still bcrypt.

   It reports the restore time and the age of the newest activity, then drops the scratch database.
3. Record the date, the file, the restore time and the data age in TEST_RESULTS.md.
4. **Delete the downloaded file.** It holds personal data (DATA_PROTECTION.md).

Proven so far: the drill passes 9/9 on a dump of the local database (2026-09-24: 1.2 s dump,
1.4 s restore). **The first drill on a production backup has not run.**

## Restoring production (the real thing)

1. Declare an incident (INCIDENT_RESPONSE.md) and stop writes if the damage is ongoing.
2. Pick the newest backup older than the damage. Run the drill on it first: never restore an untested file.
3. In cPanel: phpMyAdmin → select the database → Import the file (or ask the host to restore that snapshot).
4. Restart the Node app; check `/api/health` and `/api/settings`; sign in as platform admin; open a school.
5. Tell the schools the time window of data that may need re-entering: it equals the backup's age.
