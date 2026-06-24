import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { env } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import * as upsquadApi from '../services/upsquad-api.service.js';
import { fanOutBroadcast } from '../services/subscription.service.js';

// Map upsquad's tier vocabulary to canonical names sent downstream
// (Junior/Pro/Top Talents/Custom). Unknown values are dropped.
const TIER_MAP: Record<string, string> = {
  juniors: 'Junior',
  junior: 'Junior',
  pros: 'Pro',
  pro: 'Pro',
  'top talents': 'Top Talents',
  'top_talents': 'Top Talents',
  toptalents: 'Top Talents',
  'top talent': 'Top Talents',
  custom: 'Custom',
};
// Standard plan → daily hours from SquadHub subscription_plans table.
const PLAN_HOURS: Record<string, number> = {
  starter: 1,
  basic: 2.5,
  plus: 4.5,
  pro: 6.5,
  personal: 8,
};

function buildHoursLabel(planName: string, workingDays: string[]): {
  hours_per_day: number | null;
  hours_label: string | null;
} {
  const hpd = PLAN_HOURS[planName.toLowerCase().trim()];
  if (!hpd) return { hours_per_day: null, hours_label: null };
  const days = workingDays.length || 5;
  const perWeek = hpd * days;
  const perMonth = perWeek * 4;
  return {
    hours_per_day: hpd,
    hours_label: `${hpd} hrs/day · ${perWeek} hrs/week · ${perMonth} hrs/month`,
  };
}

function normalizeTiers(raw: string): string[] {
  return raw
    .split(',')
    .map((t) => TIER_MAP[t.trim().toLowerCase()])
    .filter((t): t is string => Boolean(t));
}

export async function listRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!env.UPSQUAD_API_URL) throw new AppError(503, 'upsquad API not configured');
    const { status, search, limit, offset } = req.query;
    const result = await upsquadApi.listSubscriptionRequests({
      status: status ? String(status) : undefined,
      search: search ? String(search) : undefined,
      limit: limit ? parseInt(String(limit), 10) : undefined,
      offset: offset ? parseInt(String(offset), 10) : undefined,
    });
    res.json({ success: true, data: result.items, total: result.total });
  } catch (err) {
    next(err);
  }
}

export async function getRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!env.UPSQUAD_API_URL) throw new AppError(503, 'upsquad API not configured');
    const id = parseInt(req.params.id as string, 10);
    if (!id) throw new AppError(400, 'Invalid ID');
    const data = await upsquadApi.getSubscriptionRequest(id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function createFromRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { subscription_request_id } = req.body;
    if (!subscription_request_id || typeof subscription_request_id !== 'number') {
      throw new AppError(400, 'subscription_request_id is required');
    }

    // Check existing
    const { data: existing } = await supabaseAdmin
      .from('subscription_cards')
      .select('*')
      .eq('subscription_request_id', subscription_request_id)
      .maybeSingle();
    if (existing) {
      res.json({ success: true, data: existing });
      return;
    }

    // Fetch from upsquad
    const requestData = await upsquadApi.getSubscriptionRequest(subscription_request_id);

    const content = {
      title: `${requestData.company || requestData.name} — ${requestData.service_type}`,
      brand_name: requestData.company || null,
      business_nature: null,
      subscription_name: requestData.service_type,
      plan_name: requestData.plan,
      working_days: requestData.working_days ? requestData.working_days.split(',').map((d: string) => d.trim()) : [],
      proposed_price: requestData.proposed_price,
      markup: 0,
      monthly_price: requestData.proposed_price,
      currency: 'INR',
      ...buildHoursLabel(
        requestData.plan || '',
        requestData.working_days ? requestData.working_days.split(',').map((d: string) => d.trim()) : [],
      ),
      deliverables_label: 'No specific deliverables',
      customer_name: requestData.name,
      customer_email: requestData.email,
      customer_phone: requestData.phone,
      custom_deliverables: [],
    };

    const tiers = normalizeTiers(requestData.tier || '');
    const match_rules = {
      category_ids: [] as string[],
      target_tiers: tiers,
    };

    const { data: card, error } = await supabaseAdmin
      .from('subscription_cards')
      .insert({
        source: 'request',
        subscription_request_id,
        external_id: null,
        content,
        match_rules,
        status: 'active',
        published_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (error) throw new AppError(500, error.message);

    // Mark as in_review on upsquad
    upsquadApi.updateSubscriptionRequestStatus(subscription_request_id, 'in_review').catch(() => {});

    res.json({ success: true, data: card });
  } catch (err) {
    next(err);
  }
}

export async function createCustom(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { customer_company, service_type, plan_name } = req.body || {};

    const content = {
      title: customer_company ? `${customer_company} — ${service_type || 'Custom'}` : 'Custom Card',
      brand_name: customer_company || null,
      subscription_name: service_type || null,
      plan_name: plan_name || null,
      working_days: [],
      proposed_price: null,
      markup: 0,
      monthly_price: null,
      ...buildHoursLabel(plan_name || '', []),
      deliverables_label: 'No specific deliverables',
      custom_deliverables: [],
    };

    const { data: card, error } = await supabaseAdmin
      .from('subscription_cards')
      .insert({
        source: 'custom',
        external_id: null,
        content,
        match_rules: { category_ids: [] },
        status: 'active',
        published_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (error) throw new AppError(500, error.message);
    res.json({ success: true, data: card });
  } catch (err) {
    next(err);
  }
}

export async function editCard(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const cardId = req.params.id as string;

    const { data: card } = await supabaseAdmin
      .from('subscription_cards')
      .select('*')
      .eq('id', cardId)
      .maybeSingle();
    if (!card) throw new AppError(404, 'Card not found');
    if (card.source !== 'request' && card.source !== 'custom') {
      throw new AppError(409, 'Only request/custom cards can be edited');
    }

    const body = req.body || {};
    const content = { ...(card.content as Record<string, unknown>) };

    if (body.brand_name !== undefined) content.brand_name = body.brand_name;
    if (body.business_nature !== undefined) content.business_nature = body.business_nature;
    if (body.notes !== undefined) content.notes = body.notes;
    if (body.working_days !== undefined) content.working_days = body.working_days;
    if (body.custom_deliverables !== undefined) content.custom_deliverables = body.custom_deliverables;
    if (body.proposed_price !== undefined) content.proposed_price = body.proposed_price;
    if (body.markup !== undefined) content.markup = body.markup;
    if (body.proposed_price !== undefined || body.markup !== undefined) {
      const price = typeof content.proposed_price === 'number' ? content.proposed_price : 0;
      const margin = typeof content.markup === 'number' ? content.markup : 0;
      content.monthly_price = price - margin;
    }

    if (body.hours_per_day !== undefined) {
      content.hours_per_day = body.hours_per_day;
      if (typeof body.hours_per_day === 'number' && body.hours_per_day > 0) {
        const days = Array.isArray(content.working_days) ? (content.working_days as string[]).length : 5;
        const perWeek = body.hours_per_day * days;
        const perMonth = perWeek * 4;
        content.hours_label = `${body.hours_per_day} hrs/day · ${perWeek} hrs/week · ${perMonth} hrs/month`;
      } else {
        content.hours_label = null;
      }
    }

    if (body.deliverables_text !== undefined) {
      content.deliverables_label = body.deliverables_text || null;
    }
    if (body.title !== undefined) content.title = body.title;

    const matchRules = { ...(card.match_rules as Record<string, unknown>) };
    if (body.category_ids !== undefined) matchRules.category_ids = body.category_ids;
    if (body.target_tiers !== undefined) matchRules.target_tiers = body.target_tiers;

    const updates: Record<string, unknown> = { content, match_rules: matchRules };
    if (body.distribution !== undefined) updates.distribution = body.distribution;

    const { data: updated, error } = await supabaseAdmin
      .from('subscription_cards')
      .update(updates)
      .eq('id', cardId)
      .select('*')
      .single();

    if (error) throw new AppError(500, error.message);
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

export async function publishCard(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const cardId = req.params.id as string;

    const { data: card } = await supabaseAdmin
      .from('subscription_cards')
      .select('*')
      .eq('id', cardId)
      .maybeSingle();
    if (!card) throw new AppError(404, 'Card not found');

    const matchRules = card.match_rules as Record<string, unknown>;
    const distribution = req.body?.distribution || card.distribution || 'broadcast';

    // Match talents and insert recipients (shared with the reopen-for-new-talents flow)
    if (distribution === 'broadcast') {
      await fanOutBroadcast(cardId, matchRules, (card.content ?? {}) as Record<string, unknown>);
    }

    // Update card status and distribution
    const { data: updated, error } = await supabaseAdmin
      .from('subscription_cards')
      .update({ status: 'active', distribution })
      .eq('id', cardId)
      .select('*')
      .single();

    if (error) throw new AppError(500, error.message);

    // Notify upsquad
    if (card.subscription_request_id) {
      upsquadApi.updateSubscriptionRequestStatus(card.subscription_request_id, 'published').catch(() => {});
    }

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

export async function deleteCard(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const cardId = req.params.id as string;

    const { data: card } = await supabaseAdmin
      .from('subscription_cards')
      .select('id, source, subscription_request_id')
      .eq('id', cardId)
      .maybeSingle();
    if (!card) throw new AppError(404, 'Card not found');
    if (card.source !== 'request' && card.source !== 'custom') {
      throw new AppError(409, 'Only request/custom cards can be deleted');
    }

    await supabaseAdmin.from('subscription_card_recipients').delete().eq('card_id', cardId);
    await supabaseAdmin.from('subscription_cards').delete().eq('id', cardId);

    if (card.subscription_request_id) {
      upsquadApi.updateSubscriptionRequestStatus(card.subscription_request_id, 'pending').catch(() => {});
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}
