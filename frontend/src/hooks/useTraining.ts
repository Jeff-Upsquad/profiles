import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import api from '@/services/api';
import type { ContentBlock } from '@/components/training/ContentBlocks';
import { blockLanguages } from '@/components/training/ContentBlocks';

export interface LessonVideo {
  language: string;
  loom_url: string;
}

/**
 * Ordered rich content on a lesson (`training_lesson_blocks`) — the same shape
 * SOP pages use, so both render through `components/training/ContentBlocks`.
 */
export type LessonBlock = ContentBlock;

/* ==================================================================== */
/* Synced content model                                                  */
/* ==================================================================== */

/**
 * What the API now returns: an item (course or SOP) holding a freely nested
 * tree of pages, each a list of content blocks. This mirrors SquadHub's
 * Resources model exactly, so a course syncs down without being flattened.
 *
 * A page counts toward progress only if it carries content — a page with no
 * blocks is a container (what used to be a "chapter").
 */
export interface TalentPage {
  id: string;
  item_id: string;
  parent_page_id: string | null;
  title: string;
  summary: string | null;
  icon: string | null;
  position: number;
  depth: number;
  linked_module: string | null;
  gates_profile_creation: boolean;
  completable: boolean;
  completed: boolean;
  unlocked: boolean;
  blocks: ContentBlock[];
  children: TalentPage[];
  total_count: number;
  completed_count: number;
}

export interface TalentItem {
  id: string;
  kind: string;
  track: string;
  title: string;
  summary: string | null;
  icon: string | null;
  cover_image_url: string | null;
  sort_order: number;
  is_onboarding: boolean;
  countdown_enabled: boolean;
  countdown_hours: number | null;
  started_at: string | null;
  expires_at: string | null;
  expired: boolean;
  categories: { id: string; name: string; slug: string }[];
  pages: TalentPage[];
  completed_count: number;
  total_count: number;
}

/**
 * Adapt the page tree to the reader's two-level shape.
 *
 * The reader presents a rail of sections, each holding a flat list of entries.
 * Arbitrary nesting still survives the trip: a section is a top-level page, its
 * entries are every content-bearing page beneath it in reading order, and each
 * entry keeps its `depth` so the rail can indent it. Nothing is dropped — only
 * the *navigation* is flattened, never the content.
 *
 * A top-level page that carries content of its own becomes the first entry in
 * its own section, so a one-page section still has something to open.
 */
function pageToLesson(page: TalentPage, chapterId: string): TrainingLesson {
  // The legacy language picker reads `videos` off the lesson. Build it from the
  // page's video blocks so per-language variants keep driving that control.
  const videos: LessonVideo[] = [];
  for (const block of page.blocks ?? []) {
    for (const v of block.videos ?? []) {
      if (!videos.some((existing) => existing.language === v.language)) {
        videos.push({ language: v.language, loom_url: v.embed_url ?? v.file_url ?? '' });
      }
    }
  }
  const firstVideo = (page.blocks ?? []).find(
    (b) => b.type === 'video_embed' || b.type === 'video_upload',
  );

  return {
    id: page.id,
    chapter_id: chapterId,
    title: page.title,
    loom_url: firstVideo?.embed_url ?? firstVideo?.file_url ?? '',
    description: page.summary ?? undefined,
    videos,
    blocks: page.blocks ?? [],
    sort_order: page.position,
    depth: page.depth,
    completed: page.completed,
  };
}

/** Content-bearing pages in a subtree, in reading order. */
function collectEntries(page: TalentPage): TalentPage[] {
  const out: TalentPage[] = [];
  const walk = (node: TalentPage) => {
    if (node.completable) out.push(node);
    for (const child of node.children ?? []) walk(child);
  };
  walk(page);
  return out;
}

export function itemToCourse(item: TalentItem): TrainingCourse {
  const chapters: TrainingChapter[] = (item.pages ?? []).map((section) => ({
    id: section.id,
    title: section.title,
    description: section.summary ?? undefined,
    sort_order: section.position,
    lessons: collectEntries(section).map((p) => pageToLesson(p, section.id)),
    completed_count: section.completed_count,
    total_count: section.total_count,
    unlocked: section.unlocked,
    linked_module: section.linked_module,
  }));

  return {
    id: item.id,
    title: item.title,
    description: item.summary ?? undefined,
    sort_order: item.sort_order,
    is_onboarding: item.is_onboarding,
    countdown_enabled: item.countdown_enabled,
    countdown_hours: item.countdown_hours,
    started_at: item.started_at,
    expires_at: item.expires_at,
    expired: item.expired,
    categories: item.categories ?? [],
    chapters,
    completed_count: item.completed_count,
    total_count: item.total_count,
  };
}

/** Languages offered anywhere in an item, for the course-level picker. */
export function itemLanguages(item: TalentItem): string[] {
  const langs = new Set<string>();
  const walk = (page: TalentPage) => {
    for (const l of blockLanguages(page.blocks)) langs.add(l);
    for (const child of page.children ?? []) walk(child);
  };
  for (const p of item.pages ?? []) walk(p);
  return [...langs];
}

export interface TrainingLesson {
  id: string;
  chapter_id: string;
  title: string;
  /** Empty when the lesson is a blocks-only document. */
  loom_url: string;
  description?: string;
  videos: LessonVideo[];
  /** Absent on older payloads; empty for a plain video lesson. */
  blocks?: LessonBlock[];
  sort_order: number;
  /** Nesting depth of the source page — the rail indents by this. */
  depth?: number;
  completed: boolean;
}

export const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English',
  hi: 'Hindi',
  ta: 'Tamil',
  te: 'Telugu',
  kn: 'Kannada',
  ml: 'Malayalam',
  bn: 'Bengali',
  mr: 'Marathi',
  gu: 'Gujarati',
  pa: 'Punjabi',
};

/**
 * Strict resolver — returns the URL for the exact selected language.
 * Falls back ONLY to the legacy `loom_url` field if no language variant
 * matches (e.g., a lesson with no per-language videos at all). Does NOT
 * silently substitute a different language.
 *
 * The course-level language picker is built from the intersection of
 * languages available across every lesson, so in practice the selected
 * language will always be present.
 */
export function pickLessonUrl(lesson: TrainingLesson, language: string): string {
  const videos = lesson.videos ?? [];
  const match = videos.find((v) => v.language === language);
  if (match) return match.loom_url;
  // Legacy fallback only — no language is silently substituted.
  return lesson.loom_url ?? '';
}

export function getAvailableLanguages(chapters: TrainingChapter[] | TrainingChapter | null | undefined): string[] {
  if (!chapters) return ['en'];
  const list = Array.isArray(chapters) ? chapters : [chapters];
  const langs = new Set<string>();
  for (const ch of list) {
    for (const lesson of ch.lessons ?? []) {
      for (const v of lesson.videos ?? []) {
        langs.add(v.language);
      }
    }
  }
  if (langs.size === 0) langs.add('en');
  return Array.from(langs);
}

export interface TrainingChapter {
  id: string;
  title: string;
  description?: string;
  sort_order: number;
  lessons: TrainingLesson[];
  completed_count: number;
  total_count: number;
  /** Computed by the API for onboarding courses; absent on legacy chapters */
  unlocked?: boolean;
  linked_module?: string | null;
}

export interface TrainingCourse {
  id: string;
  title: string;
  description?: string;
  sort_order: number;
  is_onboarding: boolean;
  countdown_enabled: boolean;
  countdown_hours: number | null;
  started_at: string | null;
  expires_at: string | null;
  expired: boolean;
  categories: { id: string; name: string; slug: string }[];
  chapters: TrainingChapter[];
  completed_count: number;
  total_count: number;
}

export interface TrainingAssignment {
  id: string;
  resource_type: 'course' | 'sop';
  resource_id: string;
  status: 'not_started' | 'in_progress' | 'completed';
  progress_percent: number;
  assigned_at: string;
  started_at: string | null;
  completed_at: string | null;
  source: string;
  notification_id: string | null;
}

export interface TrainingSopSummary {
  id: string;
  title: string;
  summary?: string | null;
  icon?: string | null;
  cover_image_url?: string | null;
  assignment_id: string;
  assignment_status: 'not_started' | 'in_progress' | 'completed';
  progress_percent: number;
  assigned_at: string;
  completed_at: string | null;
  completed: boolean;
}

export type SopBlock = ContentBlock & { page_id: string };

export interface SopPage {
  id: string;
  sop_id: string;
  parent_page_id: string | null;
  title: string;
  icon?: string | null;
  position: number;
  depth: number;
  is_active: boolean;
  /** True once the talent has read this page. Container pages are never true. */
  completed: boolean;
  blocks: SopBlock[];
}

export interface TrainingSopDetail {
  id: string;
  title: string;
  summary?: string | null;
  icon?: string | null;
  pages: SopPage[];
  languages: string[];
}

/**
 * Flatten an SOP item's page tree for the reader's page list. The reader shows
 * one page at a time from a flat sidebar, so nesting is carried as `depth` for
 * indentation rather than as structure.
 */
function itemToSopDetail(item: TalentItem): TrainingSopDetail {
  const pages: SopPage[] = [];
  const walk = (page: TalentPage) => {
    pages.push({
      id: page.id,
      sop_id: item.id,
      parent_page_id: page.parent_page_id,
      title: page.title,
      icon: page.icon,
      position: page.position,
      depth: page.depth,
      is_active: true,
      completed: page.completed,
      blocks: (page.blocks ?? []) as SopBlock[],
    });
    for (const child of page.children ?? []) walk(child);
  };
  for (const p of item.pages ?? []) walk(p);

  return {
    id: item.id,
    title: item.title,
    summary: item.summary,
    icon: item.icon,
    pages,
    languages: itemLanguages(item),
  };
}

export interface MyTrainingResponse {
  courses: TrainingCourse[];
  /** Raw items, kept alongside the adapted courses for the language picker. */
  items: TalentItem[];
  sops: TrainingSopSummary[];
  assignments?: TrainingAssignment[];
  /** Incomplete training_assignments count (sidebar badge) */
  incomplete_count?: number;
}

/**
 * Summarise an SOP item for the catalog card. SOPs are items on the 'sop'
 * track, so their progress comes from the same page counts as a course.
 */
function itemToSopSummary(
  item: TalentItem,
  assignments: TrainingAssignment[],
): TrainingSopSummary {
  const assignment = assignments.find((a) => a.resource_id === item.id);
  const complete = item.total_count > 0 && item.completed_count === item.total_count;
  return {
    id: item.id,
    title: item.title,
    summary: item.summary,
    icon: item.icon,
    cover_image_url: item.cover_image_url,
    assignment_id: assignment?.id ?? '',
    assignment_status: assignment?.status ?? (complete ? 'completed' : 'not_started'),
    progress_percent:
      item.total_count > 0 ? Math.round((100 * item.completed_count) / item.total_count) : 0,
    assigned_at: assignment?.assigned_at ?? '',
    completed_at: assignment?.completed_at ?? null,
    completed: complete,
  };
}

export function useMyTraining() {
  return useQuery<MyTrainingResponse>({
    queryKey: ['myTraining'],
    queryFn: async () => {
      const { data } = await api.get('/talent/training');
      const items: TalentItem[] = data.courses ?? [];
      const sopItems: TalentItem[] = data.sops ?? [];
      const assignments: TrainingAssignment[] = data.assignments ?? [];
      return {
        courses: items.map(itemToCourse),
        items,
        sops: sopItems.map((i) => itemToSopSummary(i, assignments)),
        assignments,
        incomplete_count: data.incomplete_count ?? 0,
      };
    },
  });
}

export function useSopDetail(sopId: string | null) {
  return useQuery<TrainingSopDetail>({
    queryKey: ['myTraining', 'sop', sopId],
    queryFn: async () => {
      const { data } = await api.get(`/talent/training/sops/${sopId}`);
      return itemToSopDetail(data);
    },
    enabled: !!sopId,
  });
}

export function useCompleteSop() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sopId: string) => {
      const { data } = await api.post(`/talent/training/sops/${sopId}/complete`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['myTraining'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

/** Lightweight badge count — falls back to myTraining cache when available. */
export function useIncompleteTrainingCount(opts: { enabled?: boolean } = {}) {
  return useQuery<number>({
    queryKey: ['myTraining', 'incomplete-count'],
    queryFn: async () => {
      const { data } = await api.get('/talent/training/incomplete-count');
      return data.count ?? 0;
    },
    enabled: opts.enabled !== false,
    staleTime: 30_000,
  });
}

/**
 * Convenience: just the courses (sorted as returned by the server).
 */
export function useMyCourses() {
  const query = useMyTraining();
  return { ...query, data: query.data?.courses ?? [] };
}

export function useOnboardingCourses() {
  return useQuery<TrainingCourse[]>({
    queryKey: ['onboardingCourses'],
    queryFn: async () => {
      const { data } = await api.get('/talent/training/onboarding-courses');
      return data.courses ?? [];
    },
  });
}

export function useCourse(courseId: string | undefined) {
  const query = useMyTraining();
  const course = query.data?.courses.find((c) => c.id === courseId) ?? null;
  return { ...query, data: course };
}

/**
 * Compute the languages available across every lesson in the course.
 *
 * Returns the INTERSECTION — only languages that EVERY lesson supports.
 * This guarantees that selecting a language at the course level plays
 * that exact language for all lessons, with no silent fallback.
 *
 * Lessons without any video variants are skipped from the intersection
 * calc (they fall back to the legacy `loom_url` field). If the
 * intersection is empty (no language is in every lesson), returns ['en']
 * so the player still has a default; in that case the picker is hidden
 * and lessons play their legacy `loom_url`.
 */
export function getCourseLanguages(course: TrainingCourse | null | undefined): string[] {
  if (!course) return ['en'];
  let intersection: Set<string> | null = null;
  for (const ch of course.chapters ?? []) {
    for (const lesson of ch.lessons ?? []) {
      const lessonLangs = new Set((lesson.videos ?? []).map((v) => v.language));
      if (lessonLangs.size === 0) continue; // skip lessons with no variants
      if (intersection === null) {
        intersection = lessonLangs;
      } else {
        const prev: Set<string> = intersection;
        intersection = new Set(Array.from(prev).filter((l) => lessonLangs.has(l)));
      }
    }
  }
  if (!intersection || intersection.size === 0) return ['en'];
  return Array.from(intersection);
}

/** localStorage helpers for per-course language selection */
export function getStoredCourseLanguage(courseId: string): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(`training_language:${courseId}`);
}

export function setStoredCourseLanguage(courseId: string, language: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(`training_language:${courseId}`, language);
}

// ---------------------------------------------------------------------------
// Course countdown helpers
// ---------------------------------------------------------------------------

/**
 * Format the time remaining until `expiresAt` as a short human string.
 * "2d 4h" / "3h 12m" / "12m" / "Overdue".
 */
export function formatRemaining(expiresAt: string | null | undefined, now: Date = new Date()): string {
  if (!expiresAt) return '';
  const diffMs = new Date(expiresAt).getTime() - now.getTime();
  if (diffMs <= 0) return 'Overdue';
  const totalMin = Math.floor(diffMs / 60_000);
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin % (60 * 24)) / 60);
  const mins = totalMin % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

/**
 * Format the duration the admin set, for display in the popup body.
 * Reads countdown_hours and prefers days when divisible by 24.
 */
export function formatDuration(hours: number | null | undefined): string {
  if (!hours || hours <= 0) return '';
  if (hours % 24 === 0) {
    const days = hours / 24;
    return days === 1 ? '1 day' : `${days} days`;
  }
  return hours === 1 ? '1 hour' : `${hours} hours`;
}

/**
 * Filter courses whose deadline is currently active for this user
 * (countdown enabled, started, and not yet expired).
 */
export function getActiveCountdowns(courses: TrainingCourse[] | undefined | null): TrainingCourse[] {
  if (!courses) return [];
  return courses.filter((c) => c.countdown_enabled && c.started_at && !c.expired);
}

export function useStartCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (courseId: string) => {
      const { data } = await api.post(`/talent/training/courses/${courseId}/start`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['myTraining'] });
      qc.invalidateQueries({ queryKey: ['onboardingCourses'] });
    },
  });
}

export function useRequestCourseReopen() {
  return useMutation({
    mutationFn: async ({ courseId, reason }: { courseId: string; reason?: string }) => {
      const { data } = await api.post(`/talent/training/courses/${courseId}/request-reopen`, {
        reason,
      });
      return data as { message: string; requestId: string; already: boolean };
    },
  });
}

/** Re-renders every `intervalMs` so countdown displays stay live. */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function useMarkLessonComplete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (lessonId: string) => {
      const { data } = await api.post(`/talent/training/lessons/${lessonId}/complete`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['myTraining'] });
      qc.invalidateQueries({ queryKey: ['onboardingTraining'] });
      qc.invalidateQueries({ queryKey: ['onboardingCourses'] });
      qc.invalidateQueries({ queryKey: ['moduleAccess'] });
      qc.invalidateQueries({ queryKey: ['profileGate'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkLessonIncomplete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (lessonId: string) => {
      const { data } = await api.delete(`/talent/training/lessons/${lessonId}/complete`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['myTraining'] });
      qc.invalidateQueries({ queryKey: ['onboardingTraining'] });
      qc.invalidateQueries({ queryKey: ['onboardingCourses'] });
      qc.invalidateQueries({ queryKey: ['moduleAccess'] });
      qc.invalidateQueries({ queryKey: ['profileGate'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Module access
// ---------------------------------------------------------------------------

interface LockedModule {
  module: string;
  chapter_id: string;
  chapter_title: string;
  completed: number;
  total: number;
}

interface ModuleAccess {
  unlocked: string[];
  locked: LockedModule[];
}

export function useModuleAccess() {
  return useQuery<ModuleAccess>({
    queryKey: ['moduleAccess'],
    queryFn: async () => {
      const { data } = await api.get('/talent/training/module-access');
      return data;
    },
  });
}

// ---------------------------------------------------------------------------
// Profile-creation gate (per category)
// ---------------------------------------------------------------------------

export interface ProfileGate {
  /** True when the talent must finish `chapter` before building this profile. */
  locked: boolean;
  /** The gate chapter to render (lessons/videos/completion), or null when the
   *  category has no profile-gate lesson (opt-in — build immediately). */
  chapter: TrainingChapter | null;
}

/**
 * Whether the talent must complete a training chapter before creating a job
 * profile in `categoryId`. Returns `locked: false` when the category has no
 * gate lesson or the lessons are already done.
 */
export function useProfileGate(categoryId: string | undefined) {
  return useQuery<ProfileGate>({
    queryKey: ['profileGate', categoryId],
    enabled: !!categoryId,
    queryFn: async () => {
      const { data } = await api.get(`/talent/training/profile-gate/${categoryId}`);
      return { locked: !!data.locked, chapter: data.chapter ?? null };
    },
  });
}

// ---------------------------------------------------------------------------
// Onboarding
// ---------------------------------------------------------------------------

export function useOnboardingTraining() {
  return useQuery<TrainingChapter | null>({
    queryKey: ['onboardingTraining'],
    queryFn: async () => {
      const { data } = await api.get('/talent/training/onboarding');
      return data.chapter ?? null;
    },
  });
}

export function useCompleteOnboarding() {
  const qc = useQueryClient();
  const { refetchUser } = useAuth();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/talent/training/complete-onboarding');
      return data;
    },
    onSuccess: async () => {
      await refetchUser();
      qc.invalidateQueries({ queryKey: ['onboardingTraining'] });
      qc.invalidateQueries({ queryKey: ['onboardingCourses'] });
      qc.invalidateQueries({ queryKey: ['myTraining'] });
    },
  });
}
