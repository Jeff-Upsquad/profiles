'use client';

import SquadBotChat from '@/views/talent/SquadBotChat';

/**
 * Help & Support — Squad Bot chat, with WhatsApp kept as a fallback link.
 * Same URL as the old WhatsApp-only page so existing links keep working.
 */
export default function ContactSupportPage() {
  return <SquadBotChat />;
}
