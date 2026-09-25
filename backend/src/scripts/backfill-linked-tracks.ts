/**
 * Align talents who applied for Jobs + Partner Program together (tracks_linked)
 * after the linked-tracks release: both pipelines on the same stage, and each
 * person's own card opened on their Jobs board. All CRM moves are silent — no
 * WhatsApp goes out.
 *
 * Usage (on the VPS, after the release is deployed and CRM Mapping has the
 * jobs_<category> boards):
 *   cd /root/Profiles/backend
 *   node dist/backend/src/scripts/backfill-linked-tracks.js --dry-run
 *   node dist/backend/src/scripts/backfill-linked-tracks.js
 */
import 'dotenv/config';
import { supabaseAdmin } from '../config/supabase.js';
import { resyncLinkedTalent } from '../services/linked-tracks.service.js';

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const { data, error } = await supabaseAdmin
    .from('talent_users')
    .select('id, full_name')
    .eq('tracks_linked', true)
    .not('suspended', 'is', true)
    .not('blacklisted', 'is', true)
    .is('application_cancelled_at', null)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<{ id: string; full_name: string | null }>;
  console.log(`${rows.length} linked talents${dryRun ? ' (dry run)' : ''}`);
  for (const row of rows) {
    const result = await resyncLinkedTalent(row.id, { dryRun });
    console.log(`${row.full_name ?? row.id}: ${result}`);
  }
}

main().then(() => process.exit(0), (err) => {
  console.error(err);
  process.exit(1);
});
