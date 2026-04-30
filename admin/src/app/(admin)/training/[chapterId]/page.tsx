'use client';

import { useParams } from 'next/navigation';
import TrainingChapterDetail from '@/views/training/TrainingChapterDetail';

export default function ChapterDetailPage() {
  const { chapterId } = useParams<{ chapterId: string }>();
  return <TrainingChapterDetail chapterId={chapterId} />;
}
