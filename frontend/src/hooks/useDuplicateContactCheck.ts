'use client';

import { useCallback, useRef, useState } from 'react';
import axios from 'axios';

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function useDuplicateContactCheck() {
  const [emailDuplicate, setEmailDuplicate] = useState(false);
  const [phoneDuplicate, setPhoneDuplicate] = useState(false);
  const [showSheet, setShowSheet] = useState(false);
  const seenRef = useRef<Map<string, boolean>>(new Map());

  const fetchExists = useCallback(
    async (payload: { email?: string; phone?: string }, cacheKey: string) => {
      const cached = seenRef.current.get(cacheKey);
      if (cached !== undefined) return cached;
      try {
        const { data } = await axios.post('/api/leads/check-existing', payload);
        const exists = !!data?.exists;
        seenRef.current.set(cacheKey, exists);
        return exists;
      } catch {
        return false;
      }
    },
    []
  );

  const checkEmail = useCallback(
    async (rawEmail: string) => {
      const email = rawEmail.trim().toLowerCase();
      if (!EMAIL_RX.test(email)) return;
      const exists = await fetchExists({ email }, `e:${email}`);
      setEmailDuplicate(exists);
      if (exists) setShowSheet(true);
    },
    [fetchExists]
  );

  const checkPhone = useCallback(
    async (rawPhone: string) => {
      // Identity is the last 10 digits — the same normalization the backend and the
      // check_contact_exists RPC use — so any number is checked regardless of country
      // code or formatting, as long as a full (10+ digit) number was entered.
      const digits = rawPhone.replace(/\D/g, '').slice(-10);
      if (digits.length < 10) return;
      const exists = await fetchExists({ phone: digits }, `p:${digits}`);
      setPhoneDuplicate(exists);
      if (exists) setShowSheet(true);
    },
    [fetchExists]
  );

  const clearEmail = useCallback(() => setEmailDuplicate(false), []);
  const clearPhone = useCallback(() => setPhoneDuplicate(false), []);

  const anyDuplicate = emailDuplicate || phoneDuplicate;

  return {
    emailDuplicate,
    phoneDuplicate,
    anyDuplicate,
    showSheet,
    setShowSheet,
    checkEmail,
    checkPhone,
    clearEmail,
    clearPhone,
  };
}
