import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/services/api';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';

interface Props {
  userId: string;
  name: string;
  isActive: boolean;
  inactiveReason?: string | null;
  size?: 'sm' | 'md';
}

export default function TalentActiveToggle({ userId, name, isActive, inactiveReason, size = 'sm' }: Props) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [sendNotification, setSendNotification] = useState(true);
  const [sendWhatsapp, setSendWhatsapp] = useState(true);

  const mutation = useMutation({
    mutationFn: async (active: boolean) => {
      const { data } = await api.patch(`/admin/users/talent/${userId}/active`, {
        is_active: active,
        ...(!active ? {
          reason: reason.trim(),
          send_notification: sendNotification,
          send_whatsapp: sendWhatsapp,
        } : {}),
      });
      return data as { delivery?: { notification_sent: boolean; whatsapp_sent: boolean } };
    },
    onSuccess: (data, active) => {
      queryClient.invalidateQueries({ queryKey: ['talent-profiles'] });
      queryClient.invalidateQueries({ queryKey: ['talent-profile'] });
      queryClient.invalidateQueries({ queryKey: ['talent-categories'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users-talent'] });
      queryClient.invalidateQueries({ queryKey: ['admin-user-detail', userId] });
      setOpen(false);
      setReason('');
      if (active) {
        toast.success('Talent marked active');
        return;
      }
      const failed = [
        sendNotification && !data.delivery?.notification_sent ? 'notification' : null,
        sendWhatsapp && !data.delivery?.whatsapp_sent ? 'WhatsApp' : null,
      ].filter(Boolean);
      if (failed.length) toast.error(`Talent marked inactive, but ${failed.join(' and ')} delivery did not complete`);
      else toast.success('Talent marked inactive');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to update talent status'),
  });

  return (
    <>
      <Button
        variant={isActive ? 'secondary' : 'primary'}
        size={size}
        loading={mutation.isPending}
        onClick={() => isActive ? setOpen(true) : mutation.mutate(true)}
      >
        {isActive ? 'Mark Inactive' : 'Mark Active'}
      </Button>
      <Modal isOpen={open} onClose={() => !mutation.isPending && setOpen(false)} title={`Mark ${name} inactive`}>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            This hides all of this Talent&apos;s profiles and stops new subscription requests until the account is active again.
          </p>
          <label className="block text-sm font-medium text-gray-700">
            Reason for inactivity
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={1000}
              rows={4}
              required
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="Explain what the Talent needs to resolve"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={sendWhatsapp} onChange={(event) => setSendWhatsapp(event.target.checked)} />
            Send template message via WhatsApp CRM
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={sendNotification} onChange={(event) => setSendNotification(event.target.checked)} />
            Send message to notification panel
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="danger" size="sm" loading={mutation.isPending} onClick={() => mutation.mutate(false)} disabled={!reason.trim()}>
              Mark Inactive
            </Button>
          </div>
        </div>
      </Modal>
      {!isActive && inactiveReason && (
        <span className="block max-w-56 truncate text-xs text-gray-500" title={inactiveReason}>
          Reason: {inactiveReason}
        </span>
      )}
    </>
  );
}
