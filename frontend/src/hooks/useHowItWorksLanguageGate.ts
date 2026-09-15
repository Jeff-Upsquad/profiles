'use client';

import { useEffect, useState } from 'react';
import type { HowItWorksLanguage } from '@/components/business/how-it-works/HowItWorksLanguageGate';

const STORAGE_KEY = 'how_it_works_language';

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStored(code: string) {
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    // ignore quota / disabled storage
  }
}

// Ported from the upsquad-site useLanguageGate: a stored language drives the
// poster/preview, but pressing play always re-opens the picker when more than
// one language exists. Selecting a language persists it and autoplays.
export function useHowItWorksLanguageGate(languages: HowItWorksLanguage[]) {
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [gateOpen, setGateOpen] = useState(false);
  const [pendingPlay, setPendingPlay] = useState(false);

  const codesKey = languages.map((l) => l.code).join(',');

  useEffect(() => {
    if (languages.length === 0) return;
    const codes = new Set(languages.map((l) => l.code));
    const stored = readStored();
    if (stored && codes.has(stored)) {
      setSelectedCode(stored);
    } else {
      setSelectedCode(languages[0].code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codesKey]);

  const selected = languages.find((l) => l.code === selectedCode) || null;

  const requestPlay = (): boolean => {
    if (languages.length <= 1) {
      if (languages.length === 1 && !selectedCode) setSelectedCode(languages[0].code);
      return true;
    }
    // Pulse pendingPlay so selecting the same language still starts playback.
    setPendingPlay(false);
    setGateOpen(true);
    return false;
  };

  const onSelectLanguage = (code: string) => {
    setSelectedCode(code);
    writeStored(code);
    setGateOpen(false);
    setPendingPlay(true);
  };

  return {
    selected,
    selectedCode,
    gateOpen,
    setGateOpen,
    pendingPlay,
    requestPlay,
    onSelectLanguage,
  };
}
