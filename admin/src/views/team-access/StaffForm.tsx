'use client';

import { useState, type FormEvent } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import {
  useCreateStaff,
  useUpdateStaff,
  type StaffSummary,
} from '@/hooks/useTeamAccess';

export default function StaffForm({
  staff,
  onSuccess,
  onCancel,
}: {
  staff?: StaffSummary;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const isEdit = !!staff;
  const createMutation = useCreateStaff();
  const updateMutation = useUpdateStaff();

  const [email, setEmail] = useState(staff?.email ?? '');
  const [name, setName] = useState(staff?.name ?? '');
  const [password, setPassword] = useState('');

  const pending = createMutation.isPending || updateMutation.isPending;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (isEdit) {
      updateMutation.mutate(
        { id: staff!.id, name, ...(password ? { password } : {}) },
        { onSuccess },
      );
    } else {
      createMutation.mutate({ email: email.trim(), name, password }, { onSuccess });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="person@company.com"
        required
        disabled={isEdit}
        helperText={isEdit ? 'Email cannot be changed.' : undefined}
      />
      <Input
        label="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Full name"
        required
      />
      <Input
        label={isEdit ? 'Reset password' : 'Password'}
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder={isEdit ? 'Leave blank to keep current password' : 'At least 8 characters'}
        required={!isEdit}
        minLength={8}
        helperText="The staff member signs in at the separate /staff portal."
      />
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          {isEdit ? 'Save changes' : 'Create staff user'}
        </Button>
      </div>
    </form>
  );
}
