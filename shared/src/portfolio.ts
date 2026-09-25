// Which talent categories have a portfolio step. Sales and Accountant job
// profiles have none: the portfolio section is hidden, submit doesn't ask for
// one, and their CRM funnel goes Job Profile → Final Review with no
// Portfolio Updation stage. Used by the talent forms, the dashboard checklist,
// the admin journey panel and the pipeline stage order.

const NO_PORTFOLIO_SLUGS = new Set(['sales', 'accountant']);

/** Category slug → form_type is 1:1 for these, so one set covers both. */
const NO_PORTFOLIO_FORM_TYPES = new Set(['sales', 'accountant']);

/** True unless this category's job profile has no portfolio. Unknown → true. */
export function categoryHasPortfolio(slug: string | null | undefined): boolean {
  return !slug || !NO_PORTFOLIO_SLUGS.has(slug);
}

/** Same rule keyed by lead/pipeline form_type (creative | accountant | sales | jobs). */
export function formTypeHasPortfolio(formType: string | null | undefined): boolean {
  return !formType || !NO_PORTFOLIO_FORM_TYPES.has(formType);
}

/**
 * Does a talent who applied under these form_types owe a portfolio? `jobs`
 * says nothing about the category, so it's ignored; with no category known
 * we keep asking for one.
 */
export function portfolioRequiredFor(formTypes: readonly string[]): boolean {
  const categories = formTypes.filter((ft) => ft !== 'jobs');
  return categories.length === 0 || categories.some((ft) => formTypeHasPortfolio(ft));
}
