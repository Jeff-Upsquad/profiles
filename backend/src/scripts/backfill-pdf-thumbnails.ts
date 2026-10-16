/**
 * Generate first-page cover thumbnails for PDF portfolio items uploaded
 * before automatic thumbnail generation existed (rows with
 * file_type = 'pdf' and no thumbnail_url). Safe to re-run: rows that already
 * have a thumbnail are skipped.
 *
 * Usage (on the VPS, after the release is deployed):
 *   cd /root/Profiles/backend
 *   node dist/backend/src/scripts/backfill-pdf-thumbnails.js --dry-run
 *   node dist/backend/src/scripts/backfill-pdf-thumbnails.js
 */
import 'dotenv/config';
import { supabaseAdmin } from '../config/supabase.js';
import {
  generatePortfolioPdfThumbnail,
  isOwnStorageUrl,
  type PortfolioThumbnailTable,
} from '../services/pdf-thumbnail.service.js';

interface PdfRow {
  id: string;
  file_url: string | null;
  ownerUserId: string | null;
}

async function talentRows(): Promise<PdfRow[]> {
  const { data, error } = await supabaseAdmin
    .from('portfolio_items')
    .select('id, file_url, talent_profiles(talent_user_id)')
    .eq('file_type', 'pdf')
    .is('thumbnail_url', null)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => ({
    id: r.id,
    file_url: r.file_url,
    ownerUserId: (Array.isArray(r.talent_profiles) ? r.talent_profiles[0] : r.talent_profiles)?.talent_user_id ?? null,
  }));
}

async function agencyRows(): Promise<PdfRow[]> {
  const { data, error } = await supabaseAdmin
    .from('agency_portfolio_items')
    .select('id, file_url, agency_user_id')
    .eq('file_type', 'pdf')
    .is('thumbnail_url', null)
    .order('created_at', { ascending: false });
  if (error) {
    console.warn(`agency_portfolio_items skipped: ${error.message}`);
    return [];
  }
  return (data ?? []).map((r: any) => ({ id: r.id, file_url: r.file_url, ownerUserId: r.agency_user_id }));
}

async function run(table: PortfolioThumbnailTable, rows: PdfRow[], dryRun: boolean) {
  let ok = 0;
  let skipped = 0;
  let failed = 0;
  console.log(`${table}: ${rows.length} PDF item(s) without a thumbnail${dryRun ? ' (dry run)' : ''}`);
  for (const row of rows) {
    if (!row.ownerUserId || !isOwnStorageUrl(row.file_url)) {
      skipped++;
      console.log(`  skip ${row.id} (not an R2 upload or no owner)`);
      continue;
    }
    if (dryRun) { ok++; continue; }
    try {
      const url = await generatePortfolioPdfThumbnail({
        table,
        itemId: row.id,
        fileUrl: row.file_url,
        ownerUserId: row.ownerUserId,
      });
      ok++;
      console.log(`  ok   ${row.id} → ${url}`);
    } catch (err) {
      failed++;
      console.error(`  fail ${row.id}: ${err instanceof Error ? err.message : err}`);
    }
  }
  console.log(`${table}: ${ok} ${dryRun ? 'eligible' : 'generated'}, ${skipped} skipped, ${failed} failed`);
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  await run('portfolio_items', await talentRows(), dryRun);
  await run('agency_portfolio_items', await agencyRows(), dryRun);
}

main().then(() => process.exit(0), (err) => {
  console.error(err);
  process.exit(1);
});
