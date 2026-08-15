'use client';

import Button from '@/components/ui/Button';
import type { IntroMeeting, IntroSenderType } from '../../../../shared/src/types/conversations';

const PROVIDER_LABEL: Record<string, string> = {
  meet: 'Google Meet',
  zoom: 'Zoom',
  teams: 'Microsoft Teams',
  other: 'Meeting link',
};

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function MeetingCard({
  meeting,
  selfType,
  canAct,
  onAccept,
  onDecline,
  onCancel,
  busy,
}: {
  meeting: IntroMeeting;
  selfType: IntroSenderType;
  canAct: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  const mine = meeting.proposed_by_id && meeting.proposed_by_type === selfType;
  const pending = meeting.status === 'proposed';
  const live = meeting.status === 'accepted' || meeting.status === 'proposed';

  return (
    <div className="max-w-[28rem] rounded-2xl border border-[#E7E7EA] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#a3a3a3]">
        {PROVIDER_LABEL[meeting.provider] ?? 'Meeting'}
      </p>
      <p className="mt-1 font-[family-name:var(--font-jakarta)] text-[15px] font-semibold text-[#0a0a0a]">
        {formatWhen(meeting.starts_at)}
      </p>
      {meeting.ends_at && (
        <p className="text-xs text-[#737373]">Until {formatWhen(meeting.ends_at)}</p>
      )}
      <p className="mt-2 text-xs font-medium capitalize text-[#525252]">{meeting.status}</p>

      {live && meeting.meeting_link && (
        <a
          href={meeting.meeting_link}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex text-sm font-semibold text-[#0a0a0a] underline underline-offset-2"
        >
          Join meeting
        </a>
      )}

      {canAct && pending && !mine && (
        <div className="mt-3 flex gap-2">
          <Button size="sm" onClick={onAccept} disabled={busy}>
            Accept
          </Button>
          <Button size="sm" variant="outline" onClick={onDecline} disabled={busy}>
            Decline
          </Button>
        </div>
      )}
      {canAct && pending && mine && (
        <div className="mt-3">
          <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel proposal
          </Button>
        </div>
      )}
    </div>
  );
}
