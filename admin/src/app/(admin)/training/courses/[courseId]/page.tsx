'use client';

import { useParams } from 'next/navigation';
import TrainingChapterList from '@/views/training/TrainingChapterList';

export default function CourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>();
  return <TrainingChapterList courseId={courseId} />;
}
