export interface AutoApprovalRule {
  field: string;
  operator:
    | 'eq'
    | 'neq'
    | 'in'
    | 'not_in'
    | 'contains_any'
    | 'contains_all'
    | 'gte'
    | 'lte'
    | 'gt'
    | 'lt';
  value: string | number | string[];
}

export interface AutoApprovalConfig {
  enabled: boolean;
  match_mode: 'all' | 'any';
  rules: AutoApprovalRule[];
  approved_redirect_url: string;
  approved_message?: string;
}

const DEFAULT_CONFIG: AutoApprovalConfig = {
  enabled: false,
  match_mode: 'all',
  rules: [],
  approved_redirect_url: '',
};

export function parseConfig(raw: unknown): AutoApprovalConfig {
  if (!raw || typeof raw !== 'object') return DEFAULT_CONFIG;
  const cfg = raw as Record<string, unknown>;
  return {
    enabled: cfg.enabled === true,
    match_mode: cfg.match_mode === 'any' ? 'any' : 'all',
    rules: Array.isArray(cfg.rules) ? cfg.rules : [],
    approved_redirect_url:
      typeof cfg.approved_redirect_url === 'string'
        ? cfg.approved_redirect_url
        : '',
    approved_message:
      typeof cfg.approved_message === 'string'
        ? cfg.approved_message
        : undefined,
  };
}

function normalize(v: unknown): string {
  return String(v ?? '').trim().toLowerCase();
}

function toNumber(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function evaluateRule(
  rule: AutoApprovalRule,
  data: Record<string, unknown>,
): boolean {
  const fieldValue = data[rule.field];

  switch (rule.operator) {
    case 'eq':
      return normalize(fieldValue) === normalize(rule.value);

    case 'neq':
      return normalize(fieldValue) !== normalize(rule.value);

    case 'in': {
      if (!Array.isArray(rule.value)) return false;
      const nv = normalize(fieldValue);
      return rule.value.some((v) => normalize(v) === nv);
    }

    case 'not_in': {
      if (!Array.isArray(rule.value)) return false;
      const nv = normalize(fieldValue);
      return !rule.value.some((v) => normalize(v) === nv);
    }

    case 'contains_any': {
      if (!Array.isArray(fieldValue) || !Array.isArray(rule.value)) return false;
      const set = new Set(fieldValue.map(normalize));
      return rule.value.some((v) => set.has(normalize(v)));
    }

    case 'contains_all': {
      if (!Array.isArray(fieldValue) || !Array.isArray(rule.value)) return false;
      const set = new Set(fieldValue.map(normalize));
      return rule.value.every((v) => set.has(normalize(v)));
    }

    case 'gte': {
      const a = toNumber(fieldValue);
      const b = toNumber(rule.value);
      return a !== null && b !== null && a >= b;
    }

    case 'lte': {
      const a = toNumber(fieldValue);
      const b = toNumber(rule.value);
      return a !== null && b !== null && a <= b;
    }

    case 'gt': {
      const a = toNumber(fieldValue);
      const b = toNumber(rule.value);
      return a !== null && b !== null && a > b;
    }

    case 'lt': {
      const a = toNumber(fieldValue);
      const b = toNumber(rule.value);
      return a !== null && b !== null && a < b;
    }

    default:
      return false;
  }
}

export function evaluateAutoApproval(
  config: AutoApprovalConfig,
  data: Record<string, unknown>,
): boolean {
  if (!config.enabled || config.rules.length === 0) return false;

  return config.match_mode === 'all'
    ? config.rules.every((r) => evaluateRule(r, data))
    : config.rules.some((r) => evaluateRule(r, data));
}
