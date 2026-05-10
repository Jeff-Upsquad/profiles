import { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { useAdminUpdateBasicProfile } from '@/hooks/useAdminTalentEdit';

interface AddressBlock {
  address: string;
  country: string;
  state: string;
  district: string;
  city: string;
  pin_code: string;
}

interface EditAddressDialogProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  initial: {
    permanent: AddressBlock;
    current: AddressBlock;
  };
}

const EMPTY: AddressBlock = {
  address: '',
  country: '',
  state: '',
  district: '',
  city: '',
  pin_code: '',
};

function emptyToNull(s: string): string | null {
  return s.trim() === '' ? null : s.trim();
}

function validatePin(pin: string): string | null {
  if (!pin) return null;
  return /^\d{6}$/.test(pin) ? null : 'PIN code must be exactly 6 digits';
}

function AddressFields({
  prefix,
  values,
  setValues,
  errors,
}: {
  prefix: string;
  values: AddressBlock;
  setValues: (v: AddressBlock) => void;
  errors: { pin?: string };
}) {
  const update = (key: keyof AddressBlock, val: string) =>
    setValues({ ...values, [key]: val });

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Input
          label={`${prefix} Address`}
          value={values.address}
          onChange={(e) => update('address', e.target.value)}
          placeholder="House / Flat / Street"
        />
      </div>
      <Input
        label="Country"
        value={values.country}
        onChange={(e) => update('country', e.target.value)}
      />
      <Input
        label="State"
        value={values.state}
        onChange={(e) => update('state', e.target.value)}
      />
      <Input
        label="District"
        value={values.district}
        onChange={(e) => update('district', e.target.value)}
      />
      <Input
        label="City"
        value={values.city}
        onChange={(e) => update('city', e.target.value)}
      />
      <Input
        label="PIN Code"
        value={values.pin_code}
        onChange={(e) => update('pin_code', e.target.value)}
        error={errors.pin}
        inputMode="numeric"
        maxLength={6}
      />
    </div>
  );
}

export default function EditAddressDialog({
  open,
  onClose,
  userId,
  initial,
}: EditAddressDialogProps) {
  const [permanent, setPermanent] = useState<AddressBlock>(EMPTY);
  const [current, setCurrent] = useState<AddressBlock>(EMPTY);

  useEffect(() => {
    if (!open) return;
    setPermanent(initial.permanent);
    setCurrent(initial.current);
  }, [open, initial]);

  const updateBasic = useAdminUpdateBasicProfile(userId);

  const permanentPinErr = validatePin(permanent.pin_code);
  const currentPinErr = validatePin(current.pin_code);

  const handleSave = async () => {
    if (permanentPinErr || currentPinErr) return;
    try {
      await updateBasic.mutateAsync({
        permanent_address: emptyToNull(permanent.address),
        permanent_country: emptyToNull(permanent.country),
        permanent_state: emptyToNull(permanent.state),
        permanent_district: emptyToNull(permanent.district),
        permanent_city: emptyToNull(permanent.city),
        permanent_pin_code: emptyToNull(permanent.pin_code),
        current_address: emptyToNull(current.address),
        country: emptyToNull(current.country),
        state: emptyToNull(current.state),
        current_district: emptyToNull(current.district),
        city: emptyToNull(current.city),
        pin_code: emptyToNull(current.pin_code),
      });
      onClose();
    } catch {
      // toast handled by hook
    }
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="Edit Address" size="lg">
      <div className="space-y-6">
        <section>
          <h3 className="mb-3 text-base font-semibold text-gray-900">Official Address</h3>
          <AddressFields
            prefix="Official"
            values={permanent}
            setValues={setPermanent}
            errors={{ pin: permanentPinErr ?? undefined }}
          />
        </section>
        <section className="border-t border-gray-200 pt-4">
          <h3 className="mb-3 text-base font-semibold text-gray-900">Current Address</h3>
          <AddressFields
            prefix="Current"
            values={current}
            setValues={setCurrent}
            errors={{ pin: currentPinErr ?? undefined }}
          />
        </section>
        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={updateBasic.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            loading={updateBasic.isPending}
            disabled={!!permanentPinErr || !!currentPinErr}
          >
            Save
          </Button>
        </div>
      </div>
    </Modal>
  );
}
