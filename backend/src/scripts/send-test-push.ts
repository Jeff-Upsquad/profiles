/**
 * Send a test push notification to verify the end-to-end FCM pipeline.
 *
 * Usage (run where backend env vars are available — e.g. on the VPS):
 *   cd /root/Profiles/backend
 *   npx tsx src/scripts/send-test-push.ts                 # most recently seen token
 *   npx tsx src/scripts/send-test-push.ts talent@mail.com # all tokens for one talent
 *
 * It doubles as a config check: if FIREBASE_SERVICE_ACCOUNT_JSON is not set,
 * it tells you push sends are disabled (the same condition that silently
 * suppresses all real notifications in production).
 *
 * The payload mirrors push.service.ts `notifyNewCard` (data-only, route=/pending)
 * so it exercises exactly the path the talent app handles.
 */
import 'dotenv/config';
import { getFirebaseApp } from '../config/firebase.js';
import { supabaseAdmin } from '../config/supabase.js';

async function main(): Promise<void> {
  const emailArg = process.argv[2]?.toLowerCase();

  const firebase = getFirebaseApp();
  if (!firebase) {
    console.error(
      '✗ FIREBASE_SERVICE_ACCOUNT_JSON is not set — push sends are DISABLED.\n' +
        '  Set it in backend/.env on the server, run deploy/reload-env.sh, then retry.',
    );
    process.exit(1);
  }

  let userIds: string[] | null = null;
  if (emailArg) {
    const { data: tu, error } = await supabaseAdmin
      .from('talent_users')
      .select('id, email')
      .eq('email', emailArg)
      .maybeSingle();
    if (error) {
      console.error('✗ Lookup failed:', error.message);
      process.exit(1);
    }
    if (!tu) {
      console.error(`✗ No talent_user with email "${emailArg}".`);
      process.exit(1);
    }
    userIds = [tu.id];
    console.log(`Targeting ${tu.email} (${tu.id})`);
  }

  let query = supabaseAdmin
    .from('push_tokens')
    .select('token, platform, user_id, last_seen_at')
    .order('last_seen_at', { ascending: false, nullsFirst: false });
  if (userIds) query = query.in('user_id', userIds);

  const { data: tokens, error } = await query.limit(emailArg ? 50 : 1);
  if (error) {
    console.error('✗ Could not read push_tokens:', error.message);
    process.exit(1);
  }
  if (!tokens || tokens.length === 0) {
    console.error(
      '✗ No push tokens found.\n' +
        '  The token only registers after the talent logs into the app — log in and retry.',
    );
    process.exit(1);
  }

  console.log(`Sending test push to ${tokens.length} token(s)...`);

  const res = await firebase.messaging().sendEachForMulticast({
    tokens: tokens.map((t) => t.token as string),
    data: {
      type: 'new_card',
      title: 'Test notification',
      body: 'If you can see this, push notifications are working 🎉',
      card_id: '',
      route: '/pending',
    },
    android: { priority: 'high' },
  });

  console.log(`✓ success: ${res.successCount}   ✗ failure: ${res.failureCount}`);
  res.responses.forEach((r, i) => {
    if (!r.success) {
      console.error(`  token[${i}] error: ${r.error?.code} — ${r.error?.message}`);
    }
  });

  process.exit(res.failureCount > 0 && res.successCount === 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
