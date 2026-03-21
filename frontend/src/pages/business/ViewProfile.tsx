import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useDiscoverProfile, useAddToShortlist, useSendInterest } from '@/hooks/useBusiness';
import { useCategoryWithFields } from '@/hooks/useCategories';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import type { CategoryField } from '@/types';

function FieldValue({ field, value }: { field: CategoryField; value: any }) {
  if (value === undefined || value === null || value === '') {
    return <span className="text-gray-400">Not provided</span>;
  }

  switch (field.field_type) {
    case 'multi_select': {
      const labels = (field.options ?? []).reduce(
        (acc, opt) => ({ ...acc, [opt.value]: opt.label }),
        {} as Record<string, string>
      );
      return (
        <div className="flex flex-wrap gap-1">
          {(value as string[]).map((v) => (
            <span
              key={v}
              className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700"
            >
              {labels[v] || v}
            </span>
          ))}
        </div>
      );
    }
    case 'select': {
      const opt = (field.options ?? []).find((o) => o.value === value);
      return <span>{opt?.label || value}</span>;
    }
    case 'currency':
      return <span>${Number(value).toLocaleString()}</span>;
    case 'file_upload':
      return (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-600 hover:underline"
        >
          View File
        </a>
      );
    default:
      return <span>{String(value)}</span>;
  }
}

export default function ViewProfile() {
  const { slug, id } = useParams<{ slug: string; id: string }>();
  const { data: profile, isLoading: profileLoading } = useDiscoverProfile(slug!, id);
  const { data: category } = useCategoryWithFields(slug);
  const addToShortlist = useAddToShortlist();
  const sendInterest = useSendInterest();

  const [showInterestModal, setShowInterestModal] = useState(false);
  const [interestMessage, setInterestMessage] = useState('');

  const handleSendInterest = () => {
    if (!id) return;
    sendInterest.mutate(
      { profileId: id, message: interestMessage },
      {
        onSuccess: () => {
          setShowInterestModal(false);
          setInterestMessage('');
        },
      }
    );
  };

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (!profile) {
    return (
      <Card className="py-12 text-center">
        <h3 className="text-lg font-semibold text-gray-900">Profile not found</h3>
      </Card>
    );
  }

  const fields = (category?.fields ?? [])
    .filter((f) => f.is_active)
    .sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link to="/business/discover" className="hover:text-indigo-600">
          Discover
        </Link>
        <span>/</span>
        <Link to={`/business/discover/${slug}`} className="hover:text-indigo-600">
          {category?.name ?? slug}
        </Link>
        <span>/</span>
        <span className="text-gray-900">Profile</span>
      </div>

      {/* Profile header */}
      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {(profile as any).talent_user?.full_name ?? 'Talent Profile'}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {category?.name} Profile
            </p>
            <div className="mt-2 flex items-center gap-2">
              <Badge variant="green">Approved</Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              loading={addToShortlist.isPending}
              onClick={() => addToShortlist.mutate(profile.id)}
            >
              <svg className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
              Shortlist
            </Button>
            <Button onClick={() => setShowInterestModal(true)}>
              Send Interest
            </Button>
          </div>
        </div>
      </Card>

      {/* Profile details */}
      <Card>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Profile Details</h2>
        <dl className="divide-y divide-gray-100">
          {fields.map((field) => {
            const value = profile.field_data?.[field.field_key];
            return (
              <div key={field.id} className="py-3 sm:flex sm:gap-4">
                <dt className="text-sm font-medium text-gray-500 sm:w-1/3">
                  {field.field_label}
                </dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:w-2/3">
                  <FieldValue field={field} value={value} />
                </dd>
              </div>
            );
          })}
        </dl>
      </Card>

      {/* Talent info */}
      {(profile as any).talent_user && (
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">About the Talent</h2>
          <dl className="divide-y divide-gray-100">
            {[
              ['Location', (profile as any).talent_user.current_location],
              ['Languages', ((profile as any).talent_user.languages_spoken ?? []).join(', ')],
              ['Preferred Districts', ((profile as any).talent_user.preferred_districts ?? []).join(', ')],
            ]
              .filter(([, val]) => val)
              .map(([label, val]) => (
                <div key={label} className="py-3 sm:flex sm:gap-4">
                  <dt className="text-sm font-medium text-gray-500 sm:w-1/3">{label}</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:w-2/3">{val}</dd>
                </div>
              ))}
          </dl>
        </Card>
      )}

      {/* Interest Modal */}
      <Modal
        open={showInterestModal}
        onClose={() => setShowInterestModal(false)}
        title="Send Interest Request"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Send a message to this talent to express your interest in hiring them.
          </p>
          <textarea
            rows={4}
            value={interestMessage}
            onChange={(e) => setInterestMessage(e.target.value)}
            placeholder="Tell the talent about the opportunity..."
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowInterestModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSendInterest}
              loading={sendInterest.isPending}
              disabled={!interestMessage.trim()}
            >
              Send Interest
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
