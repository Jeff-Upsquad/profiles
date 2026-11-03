import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';

// Transport-only test: fake configuration, local fixture, no database calls.
test('hiring transport signs JSON and returns the saved canonical brief', async () => {
  const server = createServer((req, res) => {
    assert.equal(req.headers['content-type'], 'application/json');
    assert.equal(req.headers['x-squadhub-signature'], 'fixture-secret-for-local-transport-test');
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      assert.equal(JSON.parse(body).title, 'Designer');
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: true, data: { id: 'saved-id', brief_note: 'Saved canonical title' } }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    process.env.SUPABASE_URL = 'https://fixture.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'fixture';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'fixture';
    process.env.SQUADHUB_CALLBACK_SECRET = 'fixture-secret-for-local-transport-test';
    process.env.SQUADHUB_JOB_BRIEF_URL = `http://127.0.0.1:${(server.address() as {port: number}).port}/brief`;
    const { submitJobBrief } = await import('../services/squadhub-leads.service.js');
    const saved = await submitJobBrief({ title: 'Designer' });
    assert.deepEqual(saved, { id: 'saved-id', brief_note: 'Saved canonical title' });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
  }
});
