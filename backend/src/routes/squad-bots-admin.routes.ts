import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import { roleFromAuthUser } from '../lib/auth-role.js';
import { getStaffAccess } from '../services/staff-auth.service.js';
import { meetsLevel, type ModuleGrants } from '../../../shared/src/types/access.js';
import { MIN_PORTFOLIO_ITEMS, PORTFOLIO_FORM_TYPES, TALENT_CATEGORY_OPTIONS } from '../../../shared/src/contentRoles.js';
import { categoryHasPortfolio } from '../../../shared/src/portfolio.js';
import {
  BRIDGE_HEADERS, BRIDGE_OPERATIONS, MANUAL_STAGES, nonceStore, verifyBridge, type BridgeOperation,
} from '../lib/squad-bots-admin-bridge.js';
import * as adminService from '../services/admin.service.js';
import * as hub from '../services/onboarding-hub.service.js';

/**
 * Signed surface for Squadbots working in the admin onboarding and exception
 * modules on behalf of a Squad Bots administrator. Mounted at
 * /api/integrations/squad-bots-admin. Squad Bots has already checked the
 * Squadbot's module skill. A call acts as the signed-in person when their own
 * SquadHire access covers it, otherwise as the "Squad Bots" staff account
 * (SQUAD_BOTS_SERVICE_EMAIL). Writes also need "Run action" in Squad Bots.
 */
const router = Router();
const fresh = nonceStore();

type Actor = { id: string; email: string; admin: boolean; grants: ModuleGrants };
const humanOf = (res: Response) => res.locals.squadBotsActor as Actor | null;
/** SquadHire's own account for Squadbots (staff, approvals + talents edit). Squad Bots has
 * already checked the bot's module skill, so a bot with the skill can act even when the
 * person chatting has no SquadHire access. Disabling this staff row turns that off. */
export const SQUAD_BOTS_SERVICE_EMAIL = 'squad-bots@squadhub.in';

async function resolveActor(email: string): Promise<Actor | null> {
  const { data: staff } = await supabaseAdmin.from('staff_users')
    .select('id, email, is_active').eq('email', email).maybeSingle();
  const { data: authRows } = await supabaseAdmin.rpc('get_auth_users_by_emails', { email_list: [email] });
  const authId = (authRows as { id: string }[] | null)?.[0]?.id;
  if (authId) {
    const { data } = await supabaseAdmin.auth.admin.getUserById(authId);
    if (data?.user && roleFromAuthUser(data.user) === 'admin') return { id: authId, email, admin: true, grants: {} };
  }
  if (staff?.is_active) {
    const { grants } = await getStaffAccess(staff.id as string);
    return { id: staff.id as string, email, admin: false, grants };
  }
  return null;
}

router.use(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const secret = env.SQUAD_BOTS_ADMIN_SECRET;
    if (!secret) throw new AppError(503, 'Squad Bots admin bridge is not configured');
    const verified = verifyBridge(secret, {
      actor: req.header(BRIDGE_HEADERS.actor), time: req.header(BRIDGE_HEADERS.time),
      nonce: req.header(BRIDGE_HEADERS.nonce), signature: req.header(BRIDGE_HEADERS.signature),
      method: req.method, path: req.url, body: req.method === 'GET' ? null : req.body,
    });
    if ('error' in verified) throw new AppError(401, verified.error);
    if (!fresh(req.header(BRIDGE_HEADERS.nonce)!)) throw new AppError(401, 'Squad Bots request was already used');
    res.locals.squadBotsActor = await resolveActor(verified.actor);
    res.locals.squadBotsService = await resolveActor(SQUAD_BOTS_SERVICE_EMAIL);
    next();
  } catch (err) { next(err); }
});

/** Act as the person when their own access covers it (clearest audit), else as Squad Bots. */
function allow(res: Response, op: BridgeOperation) {
  const need = BRIDGE_OPERATIONS[op];
  const can = (a: Actor | null) => !!a && (a.admin || meetsLevel(a.grants[need.module], need.level));
  const human = humanOf(res), service = res.locals.squadBotsService as Actor | null;
  if (can(human)) return human!;
  if (can(service)) return service!;
  throw new AppError(403, `The Squad Bots account in SquadHire needs ${need.level} access on ${need.module}`);
}

const ok = (res: Response, data: unknown) => res.json({ success: true, data });
const track = (v: unknown) => (v === 'jobs' ? 'jobs' : 'partner') as 'partner' | 'jobs';
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 200) : undefined);

/** Small rows for a model prompt: identity, track state and what is blocking them. */
function compactRow(u: any) {
  return {
    id: u.id, name: u.full_name, phone: u.phone, email: u.email, location: u.current_location,
    categories: u.categories, joined: u.created_at, stage: u.pipeline_stage,
    partner_status: u.partner_approval_status, wants_jobs: u.wants_jobs,
    rejection: u.rejection_reason ? { reason: u.rejection_reason, at: u.rejected_at } : null,
    cancelled: u.application_cancelled_at ? { at: u.application_cancelled_at, reason: u.application_cancelled_reason } : null,
    under_request_changes: u.under_request_changes, board_stage: u.crm_talent_stage_name,
    blocked: u.suspended || u.blacklisted ? { suspended: u.suspended, blacklisted: u.blacklisted } : null,
    is_active: u.is_active,
    journey: u.journey ? {
      course_done: u.journey.onboarding_completed, basic_done: u.journey.basic_profile_completed,
      basic_missing: u.journey.basic_missing, job_profile_done: u.journey.job_profile_completed,
      portfolio_required: u.journey.portfolio_required !== false, portfolio_items: u.journey.portfolio_items,
    } : null,
  };
}

router.get('/queue', async (req, res, next) => {
  try {
    allow(res, 'queue');
    const q = req.query;
    const view = q.view === 'rejected' || q.view === 'cancelled' ? q.view : 'active';
    const result: any = await hub.listHub({
      track: track(q.track), view, search: str(q.search), category: str(q.category),
      pipeline_stage: str(q.stage), attention: str(q.attention) as any,
      sort: q.sort === 'oldest' ? 'oldest' : 'newest', page: Math.max(1, Number(q.page) || 1), limit: 20,
    });
    const rows = (result.users ?? result.rows ?? result.data ?? []) as any[];
    ok(res, { track: track(q.track), view, total: result.total ?? rows.length, page: result.page ?? 1, rows: rows.map(compactRow) });
  } catch (err) { next(err); }
});

router.get('/talents/:id', async (req, res, next) => {
  try {
    allow(res, 'talent');
    const id = z.string().uuid().parse(req.params.id);
    ok(res, await hub.talentJourney(id, track(req.query.track)));
  } catch (err) { next(err); }
});

/** The stage model the bot reasons over, including per-category differences. */
router.get('/stages', async (_req, res, next) => {
  try {
    allow(res, 'stages');
    ok(res, {
      funnel: MANUAL_STAGES,
      terminal: ['rejected'],
      categories: TALENT_CATEGORY_OPTIONS.map((c) => ({
        value: c.value, label: c.label,
        portfolio_required: PORTFOLIO_FORM_TYPES.includes(c.value) && categoryHasPortfolio(c.slugs[0]),
        min_portfolio_items: categoryHasPortfolio(c.slugs[0]) ? Math.max(0, ...c.slugs.map((s) => MIN_PORTFOLIO_ITEMS[s] ?? (PORTFOLIO_FORM_TYPES.includes(c.value) ? 1 : 0))) : 0,
      })),
      talent_boards: await hub.getTalentPipelineConfig(),
      rejection_reasons: [
        'Incomplete application', "Doesn't meet the experience requirements",
        'Portfolio / work samples not strong enough', 'Not the right fit for this role',
        'Location not serviceable', 'Duplicate application', 'Unresponsive',
      ],
    });
  } catch (err) { next(err); }
});

router.get('/blocked', async (req, res, next) => {
  try {
    allow(res, 'blocked');
    const filter = req.query.filter === 'suspended' || req.query.filter === 'blacklisted' ? req.query.filter : 'all';
    const rows = await adminService.getBlockedTalentProfiles(str(req.query.search), undefined, filter) as any[];
    const byUser = new Map<string, any>();
    for (const r of rows) {
      const u = r.talent_users ?? {};
      const prev = byUser.get(r.talent_user_id);
      if (prev) { prev.categories.push(r.categories?.name); continue; }
      byUser.set(r.talent_user_id, {
        id: r.talent_user_id, name: u.full_name, categories: [r.categories?.name].filter(Boolean),
        suspended: u.suspended ? { reason: u.suspended_reason, at: u.suspended_at } : null,
        blacklisted: u.blacklisted ? { reason: u.blacklisted_reason, at: u.blacklisted_at } : null,
        is_active: u.is_active,
      });
    }
    ok(res, { rows: [...byUser.values()].slice(0, 50) });
  } catch (err) { next(err); }
});

const reason = z.string().trim().min(1).max(500);
const actionSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('approve_partner') }),
  z.object({ op: z.literal('reject_partner'), reason }),
  z.object({ op: z.literal('set_partner_stage'), stage: z.enum(MANUAL_STAGES), expected_stage: z.string().optional() }),
  z.object({ op: z.literal('reject_jobs'), reason }),
  z.object({ op: z.literal('reinstate_jobs') }),
  z.object({ op: z.literal('set_jobs_stage'), stage: z.enum(MANUAL_STAGES), expected_stage: z.string().optional() }),
  z.object({ op: z.literal('set_board_stage'), track: z.enum(['partner', 'jobs']), stage_id: z.string().min(1).max(100) }),
  z.object({ op: z.literal('set_webinar_attended'), attended: z.boolean() }),
  z.object({ op: z.literal('restore_rejected'), track: z.enum(['partner', 'jobs', 'both']) }),
  z.object({ op: z.literal('restore_cancelled'), track: z.enum(['partner', 'jobs']) }),
  z.object({ op: z.literal('block_user'), kind: z.enum(['suspend', 'blacklist']), reason }),
  z.object({ op: z.literal('unblock_user'), kinds: z.array(z.enum(['suspend', 'blacklist', 'inactive'])).min(1).max(3) }),
]);

async function currentStage(id: string, field: 'pipeline_stage' | 'jobs_pipeline_stage') {
  const { data } = await supabaseAdmin.from('talent_users').select(field).eq('id', id).maybeSingle();
  if (!data) throw new AppError(404, 'Talent not found');
  return (data as any)[field] as string | null;
}

router.post('/talents/:id/actions', async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const a = actionSchema.parse(req.body);
    const actor = allow(res, a.op);
    let result: unknown;
    switch (a.op) {
      case 'approve_partner': result = await adminService.approvePartnerUser(id, actor.id); break;
      case 'reject_partner': result = await adminService.rejectPartnerUser(id, actor.id, a.reason); break;
      case 'reject_jobs': result = await adminService.rejectJobsUser(id, actor.id, a.reason); break;
      case 'reinstate_jobs': result = await adminService.reinstateJobsUser(id, actor.id); break;
      case 'set_partner_stage':
      case 'set_jobs_stage': {
        const jobs = a.op === 'set_jobs_stage';
        if (a.expected_stage !== undefined && await currentStage(id, jobs ? 'jobs_pipeline_stage' : 'pipeline_stage') !== a.expected_stage) {
          throw new AppError(409, 'This talent moved since the action was proposed');
        }
        result = await adminService.updatePipelineStage(id, a.stage, jobs ? 'jobs' : 'partner');
        break;
      }
      case 'set_board_stage': result = await hub.setTalentStage(id, { stage_id: a.stage_id, track: a.track }, actor.id); break;
      case 'set_webinar_attended': result = await hub.setWebinarAttended(id, a.attended, actor.admin ? actor.id : null); break;
      case 'restore_rejected': result = await adminService.restoreRejectedUser(id, actor.id, a.track); break;
      case 'restore_cancelled': {
        const { restoreCancelledApplication } = await import('../services/request-change-reminders.service.js');
        result = await restoreCancelledApplication(id, a.track);
        break;
      }
      case 'block_user':
        result = a.kind === 'suspend' ? await adminService.suspendUser(id, true, a.reason) : await adminService.blacklistUser(id, true, a.reason);
        break;
      case 'unblock_user': {
        const done: unknown[] = [];
        if (a.kinds.includes('suspend')) done.push(await adminService.suspendUser(id, false));
        if (a.kinds.includes('blacklist')) done.push(await adminService.blacklistUser(id, false));
        if (a.kinds.includes('inactive')) done.push(await adminService.setTalentUserActive(id, { is_active: true }));
        result = done;
        break;
      }
    }
    console.info(`[squad-bots-admin] ${actor.email} ran ${a.op} on talent ${id} for ${humanOf(res)?.email ?? req.header('x-squadbots-actor')}`);
    ok(res, { op: a.op, talent_user_id: id, result: result && typeof result === 'object' && 'id' in (result as any) ? { id: (result as any).id } : result });
  } catch (err) {
    if (err instanceof z.ZodError) return next(new AppError(422, err.issues[0]?.message ?? 'Invalid action'));
    next(err);
  }
});

export default router;
