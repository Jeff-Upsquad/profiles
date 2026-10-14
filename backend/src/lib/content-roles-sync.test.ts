import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

// shared/src/contentRoles.ts is a synced copy of the same file in SquadHub and
// SquadCRM. If this fails, apply the same edit in those repos and update the
// hash in all three content-roles sync tests.
const CONTENT_ROLES_SHA256 = 'eb729546d646b17546255115d06ac52a290b83d65cb16645ee7a27d2e63cfebc';

test('contentRoles.ts matches the copies in SquadHub and SquadCRM', () => {
  const file = readFileSync(join(__dirname, '../../../shared/src/contentRoles.ts'));
  assert.equal(createHash('sha256').update(file).digest('hex'), CONTENT_ROLES_SHA256);
});
