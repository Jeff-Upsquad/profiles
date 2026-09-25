'use client';

import { Suspense } from 'react';
import SquadBotInbox from '@/views/squad-bot/SquadBotInbox';

/** Squad Bot Inbox — talent chats Squad Bot handed to the team. `talents` module. */
export default function SquadBotPage() {
  return (
    <Suspense>
      <SquadBotInbox />
    </Suspense>
  );
}
