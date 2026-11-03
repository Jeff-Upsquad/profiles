import { redirect } from 'next/navigation';

// Previously issued payment links used this address. Keep their return path working.
export default async function LegacyPaymentReturnPage({
  params,
}: {
  params: Promise<{ cardId: string }>;
}) {
  const { cardId } = await params;
  redirect(`/business/subscription/${encodeURIComponent(cardId)}?payment=done`);
}
