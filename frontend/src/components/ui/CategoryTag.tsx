import Badge from './Badge';

type BadgeVariant = 'green' | 'yellow' | 'red' | 'gray' | 'indigo' | 'blue';

const SLUG_CONFIG: Record<string, { variant: BadgeVariant; label: string }[]> = {
  designer: [{ variant: 'indigo', label: 'Designer' }],
  'video-editor': [{ variant: 'blue', label: 'Video Editor' }],
  'designer-editor': [
    { variant: 'indigo', label: 'Designer' },
    { variant: 'blue', label: 'Video Editor' },
  ],
};

interface CategoryTagProps {
  categorySlug: string;
  categoryName: string;
  compact?: boolean;
}

export default function CategoryTag({ categorySlug, categoryName, compact }: CategoryTagProps) {
  const tags = SLUG_CONFIG[categorySlug] ?? [{ variant: 'gray' as BadgeVariant, label: categoryName }];

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {tags.map((t) => (
        <Badge key={t.label} variant={t.variant} className={compact ? 'text-[10px] px-1.5 py-0' : ''}>
          {t.label}
        </Badge>
      ))}
    </span>
  );
}
