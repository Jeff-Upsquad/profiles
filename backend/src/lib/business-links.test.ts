import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBusinessLink, businessProfileLinks, hasBusinessLink, cardBusinessLinks } from '../../../shared/src/businessLinks.js';
import { updateBusinessUserSchema } from '../validators/business.validators.js';

test('one website OR one social link satisfies the profile requirement', () => {
  assert.equal(hasBusinessLink(businessProfileLinks({})), false);
  assert.equal(hasBusinessLink(businessProfileLinks({ company_website: '  ' })), false);
  assert.equal(hasBusinessLink(businessProfileLinks({ company_website: 'brand.example' })), true);
  assert.equal(hasBusinessLink(businessProfileLinks({ social_links: { instagram: 'https://instagram.com/brand' } })), true);
});

test('unsafe and malformed links cannot satisfy the requirement or appear on a card', () => {
  for (const value of ['javascript:alert(1)', 'data:text/plain,test', 'ftp://example.com', 'https://user:secret@example.com', 'not a link', 'https://']) {
    assert.equal(normalizeBusinessLink(value), null, value);
    assert.equal(updateBusinessUserSchema.safeParse({ social_links: { instagram: value } }).success, false, value);
  }
  assert.deepEqual(cardBusinessLinks({ client_links: { website: 'javascript:alert(1)' } }), []);
});

test('profile writes normalize URLs and allow clearing links without requiring every platform', () => {
  const saved = updateBusinessUserSchema.parse({ company_website: '', social_links: { instagram: ' instagram.com/brand ', youtube: '' } });
  assert.equal(saved.social_links?.instagram, 'https://instagram.com/brand');
  assert.equal(saved.company_website, '');
  assert.equal(saved.social_links?.youtube, '');
  assert.equal(updateBusinessUserSchema.safeParse({ social_links: { unexpected: 'https://example.com' } }).success, false);
});

test('client links survive direct snapshots, business profile snapshots, and forwarded briefs', () => {
  const links = { website: 'https://brand.example/', instagram: 'https://instagram.com/brand' };
  assert.deepEqual(cardBusinessLinks({ client_links: links }).map(link => link.url), Object.values(links));
  assert.equal(cardBusinessLinks({ business_profile: { website: links.website, socials: { instagram: links.instagram } } }).length, 2);
  assert.equal(cardBusinessLinks({ additional_requirements: { client_links: [links.instagram, links.instagram] } }).length, 1);
  assert.deepEqual(cardBusinessLinks({ additional_requirements: { reference_links: [links.instagram] } }), []);
});

// Exercise the submission boundary with isolated account and upstream services.
// No real database or lead API is touched by these tests.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { AppError } from '../middleware/errorHandler.middleware.js';

function submissionHarness(account: Record<string, unknown>) {
  const forwarded: Record<string, unknown>[] = [];
  const module = { exports: {} as { submitBrief: (req: unknown, res: unknown, next: (error: unknown) => void) => Promise<void> } };
  const source = readFileSync(join(__dirname, '../controllers/connect-brief.controller.ts'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  const dependencies: Record<string, unknown> = {
    '../../../shared/src/businessLinks.js': { businessProfileLinks, hasBusinessLink },
    '../services/business.service.js': { getBusinessUser: async () => account, updateBusinessUser: async () => {}, setLastBriefCurrency: async () => {} },
    '../services/squadhub-leads.service.js': { submitLandingBrief: async (payload: Record<string, unknown>) => { forwarded.push(payload); return {}; } },
    '../services/storage.service.js': {},
    '../middleware/errorHandler.middleware.js': { AppError },
  };
  new Function('require', 'exports', compiled)((key: string) => {
    assert.ok(key in dependencies, `Unexpected dependency: ${key}`);
    return dependencies[key];
  }, module.exports);
  return { controller: module.exports.submitBrief, forwarded };
}

for (const card_type of ['assignment', 'subscription']) {
  test(`${card_type}: creator submission rejects missing profile links before forwarding`, async () => {
    const { controller, forwarded } = submissionHarness({});
    let status = 200; let body: Record<string, unknown> = {};
    const res = { status: (code: number) => { status = code; return res; }, json: (value: Record<string, unknown>) => { body = value; } };
    await controller({ body: { service_types: ['social_media_creator'], card_type }, user: { id: 'business' } }, res, error => { throw error; });
    assert.equal(status, 400);
    assert.equal(body.code, 'BUSINESS_LINK_REQUIRED');
    assert.equal(forwarded.length, 0);
  });
}

test('a social-only business can submit and its saved links are forwarded with the creator brief', async () => {
  const { controller, forwarded } = submissionHarness({ social_links: { instagram: 'https://instagram.com/brand' } });
  await controller({ body: {
    service_types: ['social_media_creator'], brand_name: 'Brand', business_nature: 'Retail', business_note: 'About the brand',
    contact_name: 'Owner', email: 'owner@example.com', phone: '1234567890', card_type: 'assignment', working_days: [], languages: ['English'],
    role_requirements: { social_media_creator: { note: 'Campaign', additional_requirements: { reference_links: ['https://reference.example'] } } },
  }, user: { id: 'business', email: 'owner@example.com' } }, { json: () => {} }, error => { throw error; });
  assert.equal(forwarded.length, 1);
  const roles = forwarded[0].role_requirements as Record<string, { additional_requirements: Record<string, string[]> }>;
  assert.deepEqual(roles.social_media_creator.additional_requirements.client_links, ['https://instagram.com/brand']);
  assert.deepEqual(roles.social_media_creator.additional_requirements.reference_links, ['https://reference.example']);
});
