import { useEffect, useRef, useState, type MouseEvent } from 'react';

export interface DropdownMenuItem {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'danger';
  loading?: boolean;
  disabled?: boolean;
}

interface DropdownMenuProps {
  items: DropdownMenuItem[];
  ariaLabel?: string;
}

export default function DropdownMenu({ items, ariaLabel = 'Open actions' }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: Event) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [open]);

  const handleTriggerClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setOpen((v) => !v);
  };

  const handleItemClick = (e: MouseEvent<HTMLButtonElement>, item: DropdownMenuItem) => {
    e.stopPropagation();
    if (item.disabled || item.loading) return;
    setOpen(false);
    item.onClick();
  };

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={handleTriggerClick}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
      >
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="5" r="1.75" />
          <circle cx="12" cy="12" r="1.75" />
          <circle cx="12" cy="19" r="1.75" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-44 origin-top-right rounded-lg border border-gray-200 bg-white py-1 shadow-lg focus:outline-none"
        >
          {items.map((item, idx) => {
            const isDanger = item.variant === 'danger';
            const base = 'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50';
            const tone = isDanger
              ? 'text-red-600 hover:bg-red-50'
              : 'text-gray-700 hover:bg-gray-100';
            return (
              <button
                key={`${item.label}-${idx}`}
                type="button"
                role="menuitem"
                disabled={item.disabled || item.loading}
                onClick={(e) => handleItemClick(e, item)}
                className={`${base} ${tone}`}
              >
                {item.loading && (
                  <svg className="h-3.5 w-3.5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
