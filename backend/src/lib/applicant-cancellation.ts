export type CancellationScope = 'partner' | 'jobs' | 'both';
export type CancellationReason = 'no_response' | 'not_interested';
export type ApplicationCancellations = Partial<Record<'partner' | 'jobs', { reason: CancellationReason; at: string }>>;
export const CANCELLATION_QUESTION = "Which application are you no longer interested in? Please choose Partner Program, Jobs, or Both.";
export const CANCELLATION_BUTTONS = [
  { id: 'cancel_application:partner', title: 'Partner Program' },
  { id: 'cancel_application:jobs', title: 'Jobs' },
  { id: 'cancel_application:both', title: 'Both' },
];
export function cancellationChoice(text: string, buttonId?: string | null): CancellationScope | null {
  if (buttonId) return CANCELLATION_BUTTONS.find(b => b.id === buttonId)?.id.split(':')[1] as CancellationScope ?? null;
  const value = text.trim().toLowerCase().replace(/[.!]+$/, '');
  if (['partner program', 'partner', 'partner program only'].includes(value)) return 'partner';
  if (['jobs', 'job', 'jobs only'].includes(value)) return 'jobs';
  if (['both', 'both programs', 'both applications'].includes(value)) return 'both';
  return null;
}
export function pendingCancellation(at?: string | null, now = Date.now()): boolean {
  return !!at && now - Date.parse(at) >= 0 && now - Date.parse(at) < 24 * 60 * 60 * 1000;
}
export const CANCELLATION_INSTRUCTIONS = `When an applicant says they are not interested in applying/continuing, use ask_cancellation_scope. Always ask which application: Partner Program, Jobs, or Both, even if their first message mentions a program. Never treat declining one vacancy, a call, a payment, or quitting an active client project as cancelling their application. Quitting active work goes to the team. Do not pressure them or cancel from a vague reply. Only the confirmation flow may cancel an application; never claim cancellation without a successful action. If they change their mind, use dismiss_cancellation_question. Existing cancellation/restoration questions still go to the team.`;
