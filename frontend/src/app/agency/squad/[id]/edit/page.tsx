'use client';
import { useParams } from 'next/navigation';
import SquadMemberEditView from '@/views/agency/SquadMemberEditView';
export default function Page(){
  const params = useParams() as { id: string };
  return <SquadMemberEditView memberId={params.id} />;
}
