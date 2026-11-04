/** Read-only by default. Run on the deployed backend with --apply to deliver
 * never-delivered matches for active business requirements. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { env } from '../config/env.js';
import { reconcileTalentCardDeliveries } from '../services/talent-card-delivery.service.js';

async function main() {
  const { values } = parseArgs({ options: { apply: { type: 'boolean', default: false } } });
  const target = JSON.parse(readFileSync(resolve(__dirname, '../../../supabase/production-target.json'), 'utf8'));
  if (new URL(env.SUPABASE_URL).hostname !== `${target.project_ref}.supabase.co`) throw new Error('Wrong production target');
  const result = await reconcileTalentCardDeliveries({ apply: values.apply });
  console.info({ project: target.project_ref, apply: values.apply, ...result });
  if (result.failed) process.exitCode = 1;
}
main().catch((error) => { console.error('Delivery repair failed', { code: error?.code }); process.exitCode = 1; });
