export function cardPaymentReturnUrl(appUrl: string, cardId: string, cardType: string): string | undefined {
  if (!appUrl) return undefined;
  const section = cardType === 'assignment' ? 'assignments' : 'subscription';
  return `${appUrl.replace(/\/$/, '')}/business/${section}/${encodeURIComponent(cardId)}?payment=done`;
}
