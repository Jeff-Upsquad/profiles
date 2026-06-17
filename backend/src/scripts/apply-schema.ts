/**
 * apply-schema.ts — apply all SquadHire migrations to the demo project's
 * Postgres, one file per transaction (so an enum-add in one file and its use in
 * a later file don't collide, and duplicate version numbers don't matter).
 *
 * Run from backend/ so the `pg` dependency resolves:
 *   DEMO_REF=... DEMO_DB_PASSWORD=... MIGRATIONS_DIR=/abs/supabase/migrations \
 *     npx tsx src/scripts/apply-schema.ts
 */
import { readFileSync, readdirSync, existsSync, appendFileSync } from 'fs';
import path from 'path';
import pkg from 'pg';
const { Client } = pkg;

const ref = process.env.DEMO_REF;
const pw = process.env.DEMO_DB_PASSWORD;
const migDir = process.env.MIGRATIONS_DIR;
if (!ref || !pw || !migDir) {
  console.error('Need DEMO_REF, DEMO_DB_PASSWORD, MIGRATIONS_DIR env vars.');
  process.exit(1);
}

// Region is ap-south-1 (Mumbai). Try the IPv4 session-pooler hosts first
// (work without an IPv4 add-on), then the direct host as a fallback.
const candidates = [
  { host: `aws-0-ap-south-1.pooler.supabase.com`, port: 5432, user: `postgres.${ref}` },
  { host: `aws-1-ap-south-1.pooler.supabase.com`, port: 5432, user: `postgres.${ref}` },
  { host: `db.${ref}.supabase.co`, port: 5432, user: 'postgres' },
];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function connectWithRetry() {
  for (let attempt = 1; attempt <= 15; attempt++) {
    for (const c of candidates) {
      const client = new Client({
        host: c.host,
        port: c.port,
        user: c.user,
        password: pw,
        database: 'postgres',
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 8000,
      });
      try {
        await client.connect();
        console.log(`✓ connected via ${c.host} (${c.user})`);
        return client;
      } catch (e: any) {
        console.log(`  attempt ${attempt}: ${c.host} → ${e.message}`);
        try { await client.end(); } catch { /* ignore */ }
      }
    }
    console.log(`  …DB not ready yet, waiting (attempt ${attempt}/15)`);
    await sleep(8000);
  }
  throw new Error('Could not connect to the demo database (still provisioning?).');
}

async function main() {
  // Optional manifest of already-applied filenames → only apply NEW migrations
  // (so this is safe to re-run on every sync; migrations aren't all idempotent).
  const manifest = process.env.APPLIED_MANIFEST;
  const applied = new Set<string>(
    manifest && existsSync(manifest)
      ? readFileSync(manifest, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean)
      : [],
  );

  const all = readdirSync(migDir!).filter((f) => f.endsWith('.sql')).sort();
  const files = all.filter((f) => !applied.has(f));
  if (files.length === 0) {
    console.log(`✓ Schema already up to date (${applied.size} migrations applied, 0 new).`);
    process.exit(0);
  }
  console.log(`Applying ${files.length} new migration(s) (${applied.size} already applied)\n`);
  const client = await connectWithRetry();
  await client.query('set statement_timeout = 0');
  let ok = 0;
  for (const f of files) {
    const sql = readFileSync(path.join(migDir!, f), 'utf8');
    try {
      await client.query(sql);
      ok++;
      if (manifest) appendFileSync(manifest, `${f}\n`);
      console.log(`  ✓ ${f}`);
    } catch (e: any) {
      console.error(`\n  ✗ ${f}\n    ${e.message}\n`);
      await client.end();
      process.exit(1);
    }
  }
  console.log(`\n✅ Applied ${ok} new migration(s).`);
  await client.end();
  process.exit(0);
}

main().catch((e) => {
  console.error('apply-schema failed:', e?.message ?? e);
  process.exit(1);
});
