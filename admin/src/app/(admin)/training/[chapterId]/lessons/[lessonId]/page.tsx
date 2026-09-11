'use client';

import { useParams } from 'next/navigation';
import LessonContentEditor from '@/views/training/LessonContentEditor';

export default function LessonContentPage() {
  const { chapterId, lessonId } = useParams<{ chapterId: string; lessonId: string }>();
  return <LessonContentEditor chapterId={chapterId} lessonId={lessonId} />;
}
