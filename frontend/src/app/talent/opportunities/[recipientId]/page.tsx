import TalentOpportunityDetail from '@/components/subscriptions/TalentOpportunityDetail';

export default async function TalentOpportunityPage({
  params,
  searchParams,
}: {
  params: Promise<{ recipientId: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const [{ recipientId }, query] = await Promise.all([params, searchParams]);
  const type = query.type === 'assignment' ? 'assignment' : 'subscription';
  return <TalentOpportunityDetail recipientId={recipientId} type={type} />;
}
