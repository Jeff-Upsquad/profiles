import { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { useAdminUpdateBasicProfile } from '@/hooks/useAdminTalentEdit';

interface EditBankAccountDialogProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  initial: {
    bank_account_holder: string | null;
    bank_name: string | null;
    bank_account_number: string | null;
    bank_ifsc_code: string | null;
    bank_branch_name: string | null;
  };
}

function emptyToNull(s: string): string | null {
  return s.trim() === '' ? null : s.trim();
}

export default function EditBankAccountDialog({
  open,
  onClose,
  userId,
  initial,
}: EditBankAccountDialogProps) {
  const [holder, setHolder] = useState('');
  const [bankName, setBankName] = useState('');
  const [account, setAccount] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [branch, setBranch] = useState('');

  useEffect(() => {
    if (!open) return;
    setHolder(initial.bank_account_holder ?? '');
    setBankName(initial.bank_name ?? '');
    setAccount(initial.bank_account_number ?? '');
    setIfsc(initial.bank_ifsc_code ?? '');
    setBranch(initial.bank_branch_name ?? '');
  }, [open, initial]);

  const updateBasic = useAdminUpdateBasicProfile(userId);

  const handleSave = async () => {
    try {
      await updateBasic.mutateAsync({
        bank_account_holder: emptyToNull(holder),
        bank_name: emptyToNull(bankName),
        bank_account_number: emptyToNull(account),
        bank_ifsc_code: emptyToNull(ifsc.toUpperCase()),
        bank_branch_name: emptyToNull(branch),
      });
      onClose();
    } catch {
      // toast handled by hook
    }
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="Edit Bank Account" size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Account Holder Name"
            value={holder}
            onChange={(e) => setHolder(e.target.value)}
          />
          <Input
            label="Bank Name"
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
          />
          <Input
            label="Account Number"
            value={account}
            onChange={(e) => setAccount(e.target.value)}
          />
          <Input
            label="IFSC Code"
            value={ifsc}
            onChange={(e) => setIfsc(e.target.value.toUpperCase())}
            placeholder="HDFC0000123"
          />
          <div className="sm:col-span-2">
            <Input
              label="Branch Name"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={updateBasic.isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} loading={updateBasic.isPending}>
            Save
          </Button>
        </div>
      </div>
    </Modal>
  );
}
