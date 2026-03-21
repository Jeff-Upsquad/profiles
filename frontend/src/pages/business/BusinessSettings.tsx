import { useState, useEffect, type FormEvent } from 'react';
import { useAuth } from '@/context/AuthContext';
import api from '@/services/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import toast from 'react-hot-toast';

export default function BusinessSettings() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    company_name: '',
    company_website: '',
    industry: '',
    company_size: '',
    contact_person_name: '',
    contact_email: '',
    contact_phone: '',
  });

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const { data } = await api.get('/business/me');
        const info = data.business ?? data;
        setForm({
          company_name: info.company_name ?? '',
          company_website: info.company_website ?? '',
          industry: info.industry ?? '',
          company_size: info.company_size ?? '',
          contact_person_name: info.contact_person_name ?? '',
          contact_email: info.contact_email ?? '',
          contact_phone: info.contact_phone ?? '',
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
      await api.put('/business/me', form);
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
        <h1 className="text-2xl font-bold text-gray-900">Company Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your company profile information.
        </p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Company Name"
            value={form.company_name}
            onChange={(e) => setForm((p) => ({ ...p, company_name: e.target.value }))}
            required
          />
          <Input
            label="Email"
            value={user?.email ?? ''}
            disabled
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Company Website"
              value={form.company_website}
              onChange={(e) => setForm((p) => ({ ...p, company_website: e.target.value }))}
              placeholder="https://example.com"
            />
            <Input
              label="Industry"
              value={form.industry}
              onChange={(e) => setForm((p) => ({ ...p, industry: e.target.value }))}
            />
          </div>
          <Select
            label="Company Size"
            value={form.company_size}
            onChange={(e) => setForm((p) => ({ ...p, company_size: e.target.value }))}
            options={[
              { label: '1-10 employees', value: '1-10' },
              { label: '11-50 employees', value: '11-50' },
              { label: '51-200 employees', value: '51-200' },
              { label: '201-500 employees', value: '201-500' },
              { label: '500+ employees', value: '500+' },
            ]}
            placeholder="Select size..."
          />

          <hr className="my-4 border-gray-200" />
          <h3 className="text-sm font-medium text-gray-700">Contact Person</h3>

          <Input
            label="Contact Person Name"
            value={form.contact_person_name}
            onChange={(e) => setForm((p) => ({ ...p, contact_person_name: e.target.value }))}
            required
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Contact Email"
              type="email"
              value={form.contact_email}
              onChange={(e) => setForm((p) => ({ ...p, contact_email: e.target.value }))}
            />
            <Input
              label="Contact Phone"
              value={form.contact_phone}
              onChange={(e) => setForm((p) => ({ ...p, contact_phone: e.target.value }))}
            />
          </div>

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
