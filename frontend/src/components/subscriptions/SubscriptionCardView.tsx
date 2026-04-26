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
  const isCancelled = item.cancelled_at != null;
  const showActions = isPending && !isCancelled;
  const ctaLabel =
    typeof item.card.content.ctaLabel === 'string' && item.card.content.ctaLabel.trim().length > 0
      ? item.card.content.ctaLabel.trim()
      : 'Accept';

  const handle = (action: 'accept' | 'reject') => {
    respond.mutate({ recipientId: item.id, action });
  };

  return (
    <Card className="flex flex-col gap-4">
      <div className={isCancelled ? 'opacity-60' : ''}>
        <SubscriptionCardContent content={item.card.content} />
      </div>

      <div className="mt-auto flex items-center justify-between gap-3 pt-2">
        {showActions ? (
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
          <div className="flex flex-wrap gap-2">
            {item.status === 'accepted' && <Badge variant="green">Accepted</Badge>}
            {item.status === 'rejected' && <Badge variant="red">Rejected</Badge>}
            {isCancelled && <Badge variant="gray">Cancelled</Badge>}
          </div>
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
