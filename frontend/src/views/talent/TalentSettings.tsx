import { useState, useEffect, type FormEvent } from 'react';
import { useAuth } from '@/context/AuthContext';
import api from '@/services/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import LanguagePicker, { type LanguageEntry } from '@/components/forms/LanguagePicker';
import toast from 'react-hot-toast';

export default function TalentSettings() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    age: '',
    current_location: '',
    native_place: '',
  });
  const [languages, setLanguages] = useState<LanguageEntry[]>([]);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const { data } = await api.get('/talent/me');
        const info = data.talent ?? data;
        setForm({
          full_name: info.full_name ?? '',
          phone: info.phone ?? '',
          age: info.age?.toString() ?? '',
          current_location: info.current_location ?? '',
          native_place: info.native_place ?? '',
        });
        setLanguages(info.languages_spoken ?? []);
      } catch {
        // ignore
      }
    };
    loadProfile();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.put('/talent/me', {
        full_name: form.full_name,
        phone: form.phone,
        age: form.age ? Number(form.age) : undefined,
        current_location: form.current_location,
        native_place: form.native_place,
        languages_spoken: languages.filter((e) => e.language),
      });
      toast.success('Settings updated');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Account Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your personal information. This info is shared across all your profiles.
        </p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Full Name"
            value={form.full_name}
            onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
            required
          />
          <Input
            label="Email"
            value={user?.email ?? ''}
            disabled
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Phone (WhatsApp)"
              value={form.phone}
              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
            />
            <Input
              label="Age"
              type="number"
              value={form.age}
              onChange={(e) => setForm((p) => ({ ...p, age: e.target.value }))}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Current Location"
              value={form.current_location}
              onChange={(e) => setForm((p) => ({ ...p, current_location: e.target.value }))}
            />
            <Input
              label="Native Place"
              value={form.native_place}
              onChange={(e) => setForm((p) => ({ ...p, native_place: e.target.value }))}
            />
          </div>
          <LanguagePicker value={languages} onChange={setLanguages} />
          <div className="pt-4">
            <Button type="submit" loading={loading}>
              Save Changes
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
