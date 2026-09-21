'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CHECK_DELAY_MS = 500;

export function useDuplicateContactCheck(accountOnly = false) {
  const [emailDuplicate, setEmailDuplicate] = useState(false);
  const [phoneDuplicate, setPhoneDuplicate] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [checkingPhone, setCheckingPhone] = useState(false);
  const [showSheet, setShowSheet] = useState(false);
  const seenRef = useRef<Map<string, boolean>>(new Map());
  const emailTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phoneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emailRequestRef = useRef(0);
  const phoneRequestRef = useRef(0);

  useEffect(() => () => {
    if (emailTimerRef.current) clearTimeout(emailTimerRef.current);
    if (phoneTimerRef.current) clearTimeout(phoneTimerRef.current);
  }, []);

  const fetchExists = useCallback(
    async (payload: { email?: string; phone?: string }, cacheKey: string) => {
      const cached = seenRef.current.get(cacheKey);
      if (cached !== undefined) return cached;
      try {
        const { data } = await axios.post(
          accountOnly ? '/api/auth/check-candidate-status' : '/api/leads/check-existing', payload);
        const exists = accountOnly ? !!data?.has_account : !!data?.exists;
        seenRef.current.set(cacheKey, exists);
        return exists;
      } catch {
        return false;
      }
    },
    [accountOnly]
  );

  const checkEmail = useCallback(
    async (rawEmail: string) => {
      if (emailTimerRef.current) clearTimeout(emailTimerRef.current);
      emailTimerRef.current = null;
      const email = rawEmail.trim().toLowerCase();
      const requestId = ++emailRequestRef.current;
      if (!EMAIL_RX.test(email)) {
        setEmailDuplicate(false);
        setCheckingEmail(false);
        return;
      }
      setCheckingEmail(true);
      const exists = await fetchExists({ email }, `e:${email}`);
      if (requestId !== emailRequestRef.current) return;
      setEmailDuplicate(exists);
      setCheckingEmail(false);
      if (exists) setShowSheet(true);
    },
    [fetchExists]
  );

  const checkPhone = useCallback(
    async (rawPhone: string) => {
      if (phoneTimerRef.current) clearTimeout(phoneTimerRef.current);
      phoneTimerRef.current = null;
      // Identity is the last 10 digits — the same normalization the backend and the
      // check_contact_exists RPC use — so any number is checked regardless of country
      // code or formatting, as long as a full (10+ digit) number was entered.
      const digits = rawPhone.replace(/\D/g, '').slice(-10);
      const requestId = ++phoneRequestRef.current;
      if (digits.length < 10) {
        setPhoneDuplicate(false);
        setCheckingPhone(false);
        return;
      }
      setCheckingPhone(true);
      const exists = await fetchExists({ phone: digits }, `p:${digits}`);
      if (requestId !== phoneRequestRef.current) return;
      setPhoneDuplicate(exists);
      setCheckingPhone(false);
      if (exists) setShowSheet(true);
    },
    [fetchExists]
  );

  const scheduleEmailCheck = useCallback((rawEmail: string) => {
    if (emailTimerRef.current) clearTimeout(emailTimerRef.current);
    ++emailRequestRef.current;
    setEmailDuplicate(false);
    const valid = EMAIL_RX.test(rawEmail.trim().toLowerCase());
    setCheckingEmail(valid);
    if (!valid) return;
    emailTimerRef.current = setTimeout(() => checkEmail(rawEmail), CHECK_DELAY_MS);
  }, [checkEmail]);

  const schedulePhoneCheck = useCallback((rawPhone: string) => {
    if (phoneTimerRef.current) clearTimeout(phoneTimerRef.current);
    ++phoneRequestRef.current;
    setPhoneDuplicate(false);
    const valid = rawPhone.replace(/\D/g, '').slice(-10).length === 10;
    setCheckingPhone(valid);
    if (!valid) return;
    phoneTimerRef.current = setTimeout(() => checkPhone(rawPhone), CHECK_DELAY_MS);
  }, [checkPhone]);

  const clearEmail = useCallback(() => {
    if (emailTimerRef.current) clearTimeout(emailTimerRef.current);
    ++emailRequestRef.current;
    setEmailDuplicate(false);
    setCheckingEmail(false);
  }, []);

  const clearPhone = useCallback(() => {
    if (phoneTimerRef.current) clearTimeout(phoneTimerRef.current);
    ++phoneRequestRef.current;
    setPhoneDuplicate(false);
    setCheckingPhone(false);
  }, []);

  const anyDuplicate = emailDuplicate || phoneDuplicate;

  return {
    emailDuplicate,
    phoneDuplicate,
    checkingEmail,
    checkingPhone,
    anyDuplicate,
    showSheet,
    setShowSheet,
    checkEmail,
    checkPhone,
    scheduleEmailCheck,
    schedulePhoneCheck,
    clearEmail,
    clearPhone,
  };
}
