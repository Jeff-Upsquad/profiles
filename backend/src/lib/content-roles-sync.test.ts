import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

// shared/src/contentRoles.ts is a synced copy of the same file in SquadHub and
// SquadCRM. If this fails, apply the same edit in those repos and update the
// hash in all three content-roles sync tests.
const CONTENT_ROLES_SHA256 = 'fe9a3c6cb7ae5d0688aeabc4e3e099ca456a3998b786ab17eadd156eea7f4984';

test('contentRoles.ts matches the copies in SquadHub and SquadCRM', () => {
  const file = readFileSync(join(__dirname, '../../../shared/src/contentRoles.ts'));
  assert.equal(createHash('sha256').update(file).digest('hex'), CONTENT_ROLES_SHA256);
});
