# SquadHire independent database backup

This service exports the configured approved Supabase project, shared by Profiles
and SquadHire CRM. It runs independently of their application processes and of
SquadHub's backup service. It does not change billing or move production.

## Private configuration

Provision `/etc/squadhire-backup/.env` (0600, directory 0700) before installing.
Required settings: `PROJECT_REF`, `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`,
`PGDATABASE`, `PGSSLMODE=verify-full`, `PGSSLROOTCERT`, `POSTGRES_IMAGE`,
`BACKUP_ENCRYPTION_KEY` (32 random bytes encoded as hex), `STATE_DIR`,
`APP_ENV_FILE`, `ALERT_ENV_FILE`, `ALERT_USER_ID`, `CONFIG_FILES_JSON`,
`STALE_HOURS=30`. Never store credentials in Git or command arguments.

The dedicated source login `squadhire_backup_v1` has `pg_read_all_data` and
`BYPASSRLS`, no superuser/create-role/create-database/replication privileges,
no application-table DML grants, and default read-only transactions. RLS bypass
is necessary to prevent silent omissions. Retain the export login's password
privately; the dump does not include database-role password verifiers.

`APP_ENV_FILE` supplies the SquadHire R2 bucket credentials. A separate root-only
`ALERT_ENV_FILE` supplies credentials for Jeff's SquadHub inbox; alert requests
must never use the SquadHire database. Alert recipient UUID is verified against
`auth.users.email = jeff@upsquadconnect.com` on the Hub project. Provider credentials
retain their existing scope; keep them root-only. Source export access has its
own dedicated role. Push fallback uses the existing SquadHub server container.

## Install and schedules

For the approved migration, this utility accepts the original project and
`hhjnxrizbvygerotvrnb`. The database host (or pooler username suffix) must match
`PROJECT_REF`. Destination state must be separate, for example
`STATE_DIR=/var/lib/squadhire-backup-hhjnxrizbvygerotvrnb`; do not carry over a
pinned `PGHOSTADDR`. R2 retention uses the configured project's own namespace,
so destination backups cannot prune the original project's archives. Keep the
old configuration and key, and switch the live timer configuration only as part
of the coordinated application cutover. Frequency and freshness limits remain
unchanged.

Use the Profiles worktree -> validation -> scoped commit -> merge -> push
workflow for source changes. Deploy this standalone service from the resulting
commit using `install.sh`; no Profiles app restart is required.

```sh
bash /path/to/reviewed/tools/backup/install.sh
python3 /opt/squadhire-backup/backup.py backup
python3 /opt/squadhire-backup/restore_test.py
python3 /opt/squadhire-backup/backup.py alert-test
# Only after restore, recipient/delivery and export traffic checks pass:
systemctl enable --now squadhire-backup.timer squadhire-backup-watchdog.timer squadhire-backup-restore-check.timer
```

Daily backup: 21:30 UTC = 03:00 IST, with no randomized delay. Weekly isolated
restore: Sunday 05:00 UTC = 10:30 IST, separate from Hub's restore check.
Watchdog: every 15 minutes; alerts after 30 hours without a verified snapshot.
Persistent timers catch missed jobs after restart. A process lock prevents backup
and watchdog overlap. Failure details stay in private files, outside inbox alerts.
State lives in `/var/lib/squadhire-backup`; code in `/opt/squadhire-backup`.

## Encryption, offsite integrity and retention

The complete pg_dump custom archive and the source inventory share one
repeatable-read snapshot. All application schemas, Auth records including password
hashes/sessions/refresh tokens, policies, grants, owners, routines, triggers,
sequences and managed-schema customizations are captured by pg_dump. Required
settings files are included before packaging. Vault is currently empty; the job
fails closed if Vault secrets appear until a supported root-key recovery is added.

AES-256-GCM with a random nonce protects the compressed package. `SQHBACK1` is
the inherited file-format magic, not a project identifier. Every run uploads to
`backups/supabase/<configured-project-ref>/<run-id>/`, downloads the entire object,
checks SHA-256 and authenticates/decrypts it before marking success or pruning.
Only encrypted contents and operational manifests go to R2. Keep the recovery key
and config independently of both the VPS and R2.

Retain snapshots for 30 days: all manual copies through seven days, then one per
UTC day through day 30. Always preserve the latest verified snapshot. Keep the two
latest verified ciphertext archives on the VPS. Retention cannot touch Hub's
project prefix or ordinary uploads. Failed backups do not authorize pruning.

Initial actual source traffic was **46,581,738 bytes received** and 104,806 bytes
sent, counted by a temporary transparent TLS TCP proxy across every connection
used for the export and inventory. TLS hostname verification stayed enabled:
PGHOST was the pooler hostname, PGHOSTADDR the loopback proxy. No row contents
were recorded by the meter. This includes TLS/protocol/catalog bytes, excludes
TCP/IP headers and retransmissions, and is more useful than compressed size
(about 6.2 MB) or logical-data estimate (43,725,403 bytes). Normal scheduled runs
connect directly using verify-full TLS; no proxy is needed. At this size, 31 daily
exports receive about **1.44 GB/month**, plus ordinary app traffic and minor
transport overhead. A weekly restore downloads R2, not the source DB. Reassess
monthly and whenever history or app usage grows; Free is not guaranteed.

## Restore verification and limitations

`restore_test.py` restores a downloaded authenticated archive into a disposable
Supabase Postgres 17.6.1.084 container with no network, published ports or
production volumes. It verifies every table's row count and row digest, including
Auth. Roles are created NOLOGIN in isolation; pg_restore maps ownership to the
isolated administrator. The container is removed afterward. This proves data
recoverability, not hosted Supabase compatibility or application authorization.
The migration rehearsal must preserve/recreate actual owners, role attributes,
memberships, RLS behavior, service role permissions and restricted RPC access.

Uploaded media bytes are not in database backups. The first separate R2 inventory
found 1,524 media objects / 29,207,241,569 bytes, excluding `backups/`. Protect those
bytes separately. Dashboard/Auth/API/signing/provider settings need separate
capture/reconciliation; saved provider snapshots are point-in-time documents,
not automatically refreshed from the Management API by this service.

Private export, recovery configuration, reports and the detailed migration
checklist are in `/Users/jeffzeena/Backups/squadhire-database-backup/`.
An external monitor remains needed to detect a complete VPS or network outage;
the local watchdog cannot run while its own host is unavailable.
