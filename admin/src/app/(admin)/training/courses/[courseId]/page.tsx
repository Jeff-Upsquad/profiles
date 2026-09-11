'use client';

import { useParams } from 'next/navigation';
import CoursePageGating from '@/views/training/CoursePageGating';

export default function CourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>();
  return <CoursePageGating courseId={courseId} />;
}
