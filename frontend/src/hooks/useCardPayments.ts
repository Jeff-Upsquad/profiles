import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import toast from 'react-hot-toast';

/**
 * Card payments — the business paying for the talent it selected on a card.
 *
 * The money is collected by SquadHire on a hosted gateway page — Razorpay or
 * Cashfree, whichever SQUADbooks currently has enabled; the backend picks per
 * payment and says which one. The invoice is raised in SquadBooks and
 * WhatsApp'd to the client only once the gateway confirms the payment. So the
 * UI's job is: show the agreed figure, send the client to the hosted URL, and
 * then reflect what came back.
 */

export type CardPaymentStatus = 'created' | 'paid' | 'failed' | 'cancelled';

export type CardGateway = 'razorpay' | 'cashfree';

export interface CardPayment {
  id: string;
  status: CardPaymentStatus;
  amount: number;
  currency: string;
  period: 'per_month' | 'project';
  /** Which gateway minted this payment's hosted checkout page. */
  gateway: CardGateway;
  /** Hosted gateway URL — present while the payment is still outstanding. */
  payment_url: string | null;
  paid_at: string | null;
  /** Set once SquadBooks has raised the invoice for this payment. */
  invoice_number: string | null;
  invoice_url: string | null;
  invoice_synced_at: string | null;
  /** Set once the invoice was accepted for delivery on WhatsApp. */
  invoice_sent_at: string | null;
}

export interface CardPaymentsPayload {
  payments: Record<string, CardPayment>;
  /**
   * The gateway new payments will open, so labels can match reality before any
   * click. Null when payments are switched off entirely.
   */
  gateway: CardGateway | null;
}

/**
 * Every payment on a card, keyed by recipient id — plus the active gateway.
 *
 * `justReturnedFromCheckout` asks the server to verify against the gateway
 * rather than trust our own row — the client lands back here seconds after
 * paying and the confirmation webhook may still be in flight, and showing them
 * "Pay now" for something they just paid would be alarming.
 */
export function useCardPayments(
  cardId: string | undefined,
  opts?: { justReturnedFromCheckout?: boolean },
) {
  const refresh = opts?.justReturnedFromCheckout ?? false;
  return useQuery<CardPaymentsPayload>({
    queryKey: ['card-payments', cardId],
    queryFn: async () => {
      const { data } = await api.get(
        `/business/my-subscription-cards/${cardId}/payments${refresh ? '?refresh=1' : ''}`,
      );
      return { payments: data.payments ?? {}, gateway: data.gateway ?? null };
    },
    enabled: !!cardId,
    // While a payment is still settling, poll so the invoice details appear
    // without the client having to reload.
    refetchInterval: (query) => {
      const rows = Object.values(query.state.data?.payments ?? {});
      const settling = rows.some((p) => p.status === 'paid' && !p.invoice_number);
      return settling ? 5_000 : false;
    },
  });
}

/**
 * Start (or resume) the payment for one selected talent, then send the client
 * to the hosted checkout page. Resuming is deliberate: a client who abandoned
 * the checkout gets the same link back rather than a second charge being
 * opened.
 */
export function useStartCardPayment(cardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (recipientId: string) => {
      const { data } = await api.post(
        `/business/my-subscription-cards/${cardId}/recipients/${recipientId}/payment`,
      );
      return data as { payment: CardPayment; alreadyPaid: boolean };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['card-payments', cardId] });
      if (data.alreadyPaid) {
        toast.success('This payment has already been made.');
        return;
      }
      if (data.payment.payment_url) {
        window.location.href = data.payment.payment_url;
      } else {
        toast.error("Couldn't open the payment page. Please try again.");
      }
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Couldn't start the payment");
    },
  });
}
