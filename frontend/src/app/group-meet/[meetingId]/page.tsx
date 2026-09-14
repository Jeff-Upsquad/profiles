'use client';

import { use } from 'react';
import GroupMeetRoom from '@/components/group-meet/GroupMeetRoom';

export default function GroupMeetRoomPage({ params }: { params: Promise<{ meetingId: string }> }) {
  const { meetingId } = use(params);
  return <GroupMeetRoom meetingId={meetingId} />;
}
