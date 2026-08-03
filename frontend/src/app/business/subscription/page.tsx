import { redirect } from 'next/navigation';

/** List view folded into unified Find talent hub. Detail routes stay. */
export default function BusinessSubscriptionPage() {
  redirect('/business/hire');
}
