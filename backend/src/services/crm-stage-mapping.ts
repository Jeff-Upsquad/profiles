// ---------------------------------------------------------------------------
// CRM stage-mapping helpers — single source of truth for translating between
// Profiles' internal lead_status_enum keys and the live CRM pipeline stages.
//
// The CRM pipeline is the source of truth for stage NAMES, ORDER and existence.
// Each pipeline stores a cached `stages` snapshot ([{id,name,sort_order}]) that
// the admin refreshes from the CRM, and `mappings` anchors each internal status
// key to a stable CRM stage **id** (not its name) so a rename in the CRM flows
// through automatically — the id never changes, only the displayed name does.
//
// Back-compat: older configs stored `mappings` as internalKey -> stage NAME
// (a plain string) with no `stages` snapshot. Every helper below tolerates that
// shape and treats the value as a literal stage name until an admin refreshes
// the page (which re-keys the mapping to ids). Nothing needs a data migration.
// ---------------------------------------------------------------------------

export interface CrmStage {
  id: string;
  name: string;
  sort_order: number;
}

export interface PipelineConfig {
  pipeline_name: string;
  // internalKey -> CRM stage id (new) or CRM stage name (legacy).
  mappings: Record<string, string>;
  // Cached snapshot of the CRM pipeline's stages. Absent on legacy configs.
  stages?: CrmStage[];
}

export interface CrmStatusMapping {
  crm_webhook_url: string;
  pipelines: Record<string, PipelineConfig>;
}

export function normalizeStage(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, ' ');
}

// Canonical creative-pipeline statuses — mirror of admin/src/constants/leadStages.ts
// (CREATIVE_STAGES) and automation.service.ts (CREATIVE_STAGE_ORDER). Keep in sync.
// The inbound CRM webhook uses this so a creative lead can never be set to a
// non-creative status (e.g. the partner-pipeline `onboard_completed`) — the exact
// corruption a duplicate-stage-id mapping collision would otherwise produce.
export const CREATIVE_STATUSES: readonly string[] = [
  'new', 'share_form', 'form_filled', 'shortlisted', 'signed_up',
  'onboarding_training', 'basic_profile', 'job_profile', 'portfolio_updation',
  'final_review', 'live', 'no_response',
];

/**
 * The statuses a given form_type's leads may legitimately hold, when that
 * vocabulary is well-defined. Returns null for pipelines with a mixed /
 * unconstrained vocabulary (e.g. "sales"), signalling callers not to restrict.
 */
export function validStatusesForFormType(
  formType: string | null | undefined,
): ReadonlySet<string> | null {
  // creative + sales are talent-onboarding funnels sharing this vocabulary.
  return formType === 'creative' || formType === 'sales'
    ? new Set(CREATIVE_STATUSES)
    : null;
}

/**
 * Resolve the live CRM stage NAME for an internal status key within a pipeline.
 * Prefers the snapshot (mapping value is a stage id → current name); falls back
 * to treating the mapping value as a literal name (legacy). Returns null when
 * the key is unmapped or maps to a stage that no longer exists.
 */
export function resolveStageName(
  pipeline: PipelineConfig | undefined,
  internalKey: string,
): string | null {
  if (!pipeline) return null;
  const value = pipeline.mappings?.[internalKey];
  if (!value) return null;

  const stages = pipeline.stages ?? [];
  const byId = stages.find((s) => s.id === value);
  if (byId) return byId.name;

  // Legacy value stored as a stage name, or a snapshot that doesn't contain the
  // mapped id (e.g. stage removed in CRM). If the value still matches a current
  // stage name, use the canonical casing; otherwise return the raw value so the
  // outbound webhook keeps working exactly as before the snapshot existed.
  const byName = stages.find((s) => normalizeStage(s.name) === normalizeStage(value));
  return byName ? byName.name : value;
}

/**
 * Build a { formType -> { internalKey -> stageName } } map of resolved labels,
 * for the admin UI and the Leads boards to render CRM names per pipeline.
 */
export function computeStageLabels(
  mapping: CrmStatusMapping | null | undefined,
): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  if (!mapping?.pipelines) return out;
  for (const [formType, pipeline] of Object.entries(mapping.pipelines)) {
    const labels: Record<string, string> = {};
    for (const key of Object.keys(pipeline?.mappings ?? {})) {
      const name = resolveStageName(pipeline, key);
      if (name) labels[key] = name;
    }
    out[formType] = labels;
  }
  return out;
}

/**
 * Reverse lookup for inbound CRM webhooks: given a lead's pipeline, translate a
 * CRM stage (by id when the webhook provides one, else by current name) back to
 * the internal status key. Rename-proof when matching by id.
 *
 * When a mapping is non-injective (two internal keys point at the same CRM
 * stage — the defect behind the creative `live`↔`onboard_completed` corruption),
 * resolving the winner by object-key order is silently wrong. Pass `opts.prefer`
 * (the statuses valid for the lead's form_type) so the pipeline-appropriate key
 * wins; genuine ambiguity keeps the first seen and is logged.
 */
export function buildReverseLookup(
  pipeline: PipelineConfig | undefined,
  opts: { prefer?: ReadonlySet<string> | null } = {},
): {
  byId: Record<string, string>;
  byName: Record<string, string>;
} {
  const byId: Record<string, string> = {};
  const byName: Record<string, string> = {};
  if (!pipeline?.mappings) return { byId, byName };

  const prefer = opts.prefer ?? null;
  const stages = pipeline.stages ?? [];

  const assign = (bucket: Record<string, string>, key: string, internalKey: string) => {
    const cur = bucket[key];
    if (cur === undefined || cur === internalKey) {
      bucket[key] = internalKey;
      return;
    }
    const curPreferred = prefer?.has(cur) ?? false;
    const newPreferred = prefer?.has(internalKey) ?? false;
    if (newPreferred && !curPreferred) {
      bucket[key] = internalKey;
    } else if (!curPreferred && !newPreferred) {
      // Neither side is pipeline-valid — a genuinely ambiguous mapping. Keep the
      // first seen (deterministic) and surface it so ops can fix the config.
      console.warn(
        `[crm-stage-mapping] ambiguous reverse map for "${key}": [${cur}, ${internalKey}] ` +
          `in pipeline "${pipeline.pipeline_name}"`,
      );
    }
    // else: current is preferred and new is not — keep current.
  };

  for (const [internalKey, value] of Object.entries(pipeline.mappings)) {
    if (!value) continue;
    const stage = stages.find((s) => s.id === value);
    if (stage) {
      assign(byId, stage.id, internalKey);
      assign(byName, normalizeStage(stage.name), internalKey);
    } else {
      // Legacy name-valued mapping (no snapshot / stage removed).
      assign(byName, normalizeStage(value), internalKey);
    }
  }
  return { byId, byName };
}
