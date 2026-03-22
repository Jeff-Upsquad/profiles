'use client';

import { use } from 'react';
import FieldManager from '@/pages/categories/FieldManager';

interface Params {
  id: string;
}

export default function FieldsPage(props: { params: Promise<Params> }) {
  const params = use(props.params);
  return <FieldManager categoryId={params.id} />;
}
