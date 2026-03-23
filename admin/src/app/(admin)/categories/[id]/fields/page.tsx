'use client';

import { use } from 'react';
import FieldManager from '@/views/categories/FieldManager';
import TemplateManager from '@/views/categories/TemplateManager';

interface Params {
  id: string;
}

export default function FieldsPage(props: { params: Promise<Params> }) {
  const params = use(props.params);
  return (
    <div className="space-y-8">
      <FieldManager categoryId={params.id} />
      <TemplateManager categoryId={params.id} />
    </div>
  );
}
