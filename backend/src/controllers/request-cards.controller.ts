import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { env } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import { findMatchingTalents } from '../services/subscription-matcher.service.js';
import * as upsquadApi from '../services/upsquad-api.service.js';

// Map upsquad's tier vocabulary (Juniors/Pros/Elites) to canonical names.
const TIER_MAP: Record<string, string> = {
  juniors: 'Junior',
  junior: 'Junior',
  pros: 'Pro',
  pro: 'Pro',
  elites: 'Elite',
  elite: 'Elite',
  custom: 'Custom',
};
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
    if (body.markup !== undefined) {
      content.markup = body.markup;
      content.monthly_price = ((content.proposed_price as number) || 0) + (body.markup || 0);
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
    const categoryIds = Array.isArray(matchRules?.category_ids) ? matchRules.category_ids : [];
    const distribution = req.body?.distribution || card.distribution || 'broadcast';

    // Match talents and insert recipients
    if (distribution === 'broadcast' && categoryIds.length > 0) {
      const talentIds = await findMatchingTalents(matchRules as any);
      if (talentIds.length > 0) {
        const rows = talentIds.map((tid) => ({
          card_id: cardId,
          talent_user_id: tid,
          status: 'pending',
        }));
        await supabaseAdmin
          .from('subscription_card_recipients')
          .upsert(rows, { onConflict: 'card_id,talent_user_id', ignoreDuplicates: true });
      }
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
