'use client';

import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import SubscriptionCardContent from './SubscriptionCardContent';
import {
  useRespondToSubscriptionCard,
  type SubscriptionCardItem,
} from '@/hooks/useSubscriptionCards';

interface Props {
  item: SubscriptionCardItem;
}

export default function SubscriptionCardView({ item }: Props) {
  const respond = useRespondToSubscriptionCard();
  const isPending = item.status === 'pending';
  const ctaLabel =
    typeof item.card.content.ctaLabel === 'string' && item.card.content.ctaLabel.trim().length > 0
      ? item.card.content.ctaLabel.trim()
      : 'Accept';

  const handle = (action: 'accept' | 'reject') => {
    respond.mutate({ recipientId: item.id, action });
  };

  return (
    <Card className="flex flex-col gap-4">
      <SubscriptionCardContent content={item.card.content} />

      <div className="mt-auto flex items-center justify-between gap-3 pt-2">
        {isPending ? (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handle('reject')}
              loading={respond.isPending && respond.variables?.action === 'reject'}
              disabled={respond.isPending}
            >
              Reject
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handle('accept')}
              loading={respond.isPending && respond.variables?.action === 'accept'}
              disabled={respond.isPending}
            >
              {ctaLabel}
            </Button>
          </>
        ) : (
          <Badge variant={item.status === 'accepted' ? 'green' : 'red'}>
            {item.status === 'accepted' ? 'Accepted' : 'Rejected'}
          </Badge>
        )}
      </div>

      {respond.isError && (
        <p className="text-xs text-red-600">
          Could not save your response. Please try again.
        </p>
      )}
    </Card>
  );
}
