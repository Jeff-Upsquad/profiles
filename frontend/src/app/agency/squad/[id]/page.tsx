'use client';
import { useParams } from 'next/navigation';
import SquadMemberPublicView from '@/views/agency/SquadMemberPublicView';
export default function Page(){
  const params = useParams() as { id: string };
  return <SquadMemberPublicView memberId={params.id} />;
}
