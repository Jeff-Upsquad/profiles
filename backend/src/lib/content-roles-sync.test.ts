import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

// shared/src/contentRoles.ts is a synced copy of the same file in SquadHub and
// SquadCRM. If this fails, apply the same edit in those repos and update the
// hash in all three content-roles sync tests.
const CONTENT_ROLES_SHA256 = 'f541c0c85c3c36ad2c1ac87ac3a5af646570b564e951406b4822cb7c887076a0';

test('contentRoles.ts matches the copies in SquadHub and SquadCRM', () => {
  const file = readFileSync(join(__dirname, '../../../shared/src/contentRoles.ts'));
  assert.equal(createHash('sha256').update(file).digest('hex'), CONTENT_ROLES_SHA256);
});
