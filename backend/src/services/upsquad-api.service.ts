import { env } from '../config/env.js';

const TIMEOUT_MS = 5_000;

export interface SubscriptionRequest {
  id: number;
  service_type: string;
  tier: string;
  plan: string;
  proposed_price: number;
  working_days: string;
  name: string;
  email: string;
  company: string;
  phone: string;
  status: string;
  created_at: string;
}

async function upsquadFetch(path: string, options: RequestInit = {}): Promise<Response> {
  if (!env.UPSQUAD_API_URL || !env.UPSQUAD_API_TOKEN) {
    throw new Error('UPSQUAD_API_URL or UPSQUAD_API_TOKEN not configured');
  }

  const url = `${env.UPSQUAD_API_URL.replace(/\/$/, '')}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.UPSQUAD_API_TOKEN}`,
        ...options.headers,
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function listSubscriptionRequests(params: {
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ items: SubscriptionRequest[]; total: number }> {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  if (params.search) qs.set('search', params.search);
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.offset) qs.set('offset', String(params.offset));

  const res = await upsquadFetch(`/api/v1/admin/subscription-requests?${qs.toString()}`);
  if (!res.ok) throw new Error(`upsquad API: ${res.status} ${res.statusText}`);
  return res.json() as Promise<{ items: SubscriptionRequest[]; total: number }>;
}

export async function getSubscriptionRequest(id: number): Promise<SubscriptionRequest> {
  const res = await upsquadFetch(`/api/v1/admin/subscription-requests/${id}`);
  if (!res.ok) throw new Error(`upsquad API: ${res.status} ${res.statusText}`);
  const body = await res.json() as { data: SubscriptionRequest };
  return body.data;
}

export async function updateSubscriptionRequestStatus(id: number, status: string): Promise<void> {
  const res = await upsquadFetch(`/api/v1/admin/subscription-requests/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    console.error(`[upsquad] Failed to update request ${id} status: ${res.status}`);
  }
}
