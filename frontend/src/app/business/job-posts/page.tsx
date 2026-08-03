import { redirect } from 'next/navigation';

/** List view folded into unified Find talent hub. Detail / console routes stay. */
export default function JobPostsPage() {
  redirect('/business/hire');
}
