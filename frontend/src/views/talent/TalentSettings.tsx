import { useState, useEffect, type FormEvent } from 'react';
import { useAuth } from '@/context/AuthContext';
import api from '@/services/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
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
    languages_spoken: '',
    preferred_districts: '',
  });

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
          languages_spoken: (info.languages_spoken ?? []).join(', '),
          preferred_districts: (info.preferred_districts ?? []).join(', '),
        });
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
        languages_spoken: form.languages_spoken
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        preferred_districts: form.preferred_districts
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
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
          <Input
            label="Languages Spoken (comma-separated)"
            value={form.languages_spoken}
            onChange={(e) => setForm((p) => ({ ...p, languages_spoken: e.target.value }))}
            placeholder="English, Hindi, Tamil"
          />
          <Input
            label="Preferred Districts (comma-separated)"
            value={form.preferred_districts}
            onChange={(e) => setForm((p) => ({ ...p, preferred_districts: e.target.value }))}
            placeholder="Chennai, Bangalore, Mumbai"
          />

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
