import assert from 'node:assert/strict';
import { test } from 'node:test';
import { focusManager, QueryClient, QueryObserver } from '@tanstack/react-query';
import {
  invalidateProfileReviewQueries,
  reviewStatusQueryOptions,
} from '../src/lib/profileReviewCache.ts';

function createClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 120_000, refetchOnWindowFocus: false, retry: false, gcTime: Infinity },
    },
  });
}

test('review decisions invalidate cached detail, filtered queues, both onboarding tracks and talent views', async () => {
  const client = createClient();
  const affectedKeys = [
    ['review', 'profile-a'],
    ['review', 'profile-b'],
    ['reviews', 'accountant', 'pending_review'],
    ['reviews', '', 'changes_requested'],
    ['onboarding-journey', 'partner', 'talent-a'],
    ['onboarding-journey', 'jobs', 'talent-a'],
    ['onboarding-hub', 'partner', 'active'],
    ['onboarding-hub-stats', 'jobs', 'all'],
    ['talent-profile', 'profile-a'],
    ['talent-profiles', 'accountant'],
  ];
  for (const key of affectedKeys) client.setQueryData(key, { status: 'pending_review' });
  client.setQueryData(['category-fields', 'accountant'], []);

  await invalidateProfileReviewQueries(client);

  for (const key of affectedKeys) {
    assert.equal(client.getQueryState(key).isInvalidated, true, JSON.stringify(key));
  }
  assert.equal(client.getQueryState(['category-fields', 'accountant']).isInvalidated, false);
  client.clear();
});

test('reopening a review fetches the current status even within the global two-minute cache window', async () => {
  const client = createClient();
  const key = ['review', 'profile-a'];
  client.setQueryData(key, { status: 'pending_review' });
  let fetches = 0;
  const observer = new QueryObserver(client, {
    queryKey: key,
    queryFn: async () => {
      fetches++;
      return { status: 'approved' };
    },
    ...reviewStatusQueryOptions,
  });
  let unsubscribe;
  await new Promise((resolve) => {
    unsubscribe = observer.subscribe((result) => {
      if (result.data?.status === 'approved' && !result.isFetching) resolve();
    });
  });
  assert.equal(fetches, 1);
  assert.equal(observer.getCurrentResult().data.status, 'approved');
  unsubscribe();
  client.clear();
});

test('refresh after a decision or a stale approval error updates an open onboarding panel', async () => {
  const client = createClient();
  const key = ['onboarding-journey', 'partner', 'talent-a'];
  client.setQueryData(key, { profiles: [{ status: 'pending_review' }] });
  const observer = new QueryObserver(client, {
    queryKey: key,
    queryFn: async () => ({ profiles: [{ status: 'approved' }] }),
  });
  const unsubscribe = observer.subscribe(() => {});

  await invalidateProfileReviewQueries(client);

  assert.equal(observer.getCurrentResult().data.profiles[0].status, 'approved');
  assert.equal(observer.getCurrentResult().isFetching, false);
  unsubscribe();
  client.clear();
});

test('returning to a review screen picks up an approval made in another session', async () => {
  const client = createClient();
  client.mount();
  focusManager.setFocused(false);
  let status = 'pending_review';
  const observer = new QueryObserver(client, {
    queryKey: ['review', 'profile-a'],
    queryFn: async () => ({ status }),
    ...reviewStatusQueryOptions,
  });
  let unsubscribe;
  await new Promise((resolve) => {
    unsubscribe = observer.subscribe((result) => {
      if (result.isSuccess && !result.isFetching) resolve();
    });
  });
  status = 'approved';
  const updated = new Promise((resolve) => {
    const stop = observer.subscribe((result) => {
      if (result.data?.status === 'approved' && !result.isFetching) {
        stop();
        resolve();
      }
    });
  });
  focusManager.setFocused(true);
  await updated;
  assert.equal(observer.getCurrentResult().data.status, 'approved');
  unsubscribe();
  client.unmount();
  client.clear();
  focusManager.setFocused(undefined);
});
