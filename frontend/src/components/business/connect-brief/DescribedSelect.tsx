'use client';

import { useEffect, useId, useRef, useState } from 'react';

type Option = { value: string; label?: string; description: string };
export default function DescribedSelect({ label, value, options, onChange, required = false }: {
  label: string; value: string; options: Option[]; onChange: (value: string) => void; required?: boolean;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const selected = options[selectedIndex];
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [open]);
  function choose(index: number) {
    onChange(options[index].value); setOpen(false); trigger.current?.focus();
  }
  return <div ref={root} className="relative min-w-0" onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
  }}>
    <label id={`${id}-label`} htmlFor={`${id}-trigger`} className={required ? "block text-sm font-medium text-[#222]" : "block text-xs font-semibold text-[#525252]"}>{label}{required && <span aria-hidden="true" className="text-[#C13515]">*</span>}</label>
    <button ref={trigger} id={`${id}-trigger`} type="button" role="combobox"
      aria-labelledby={`${id}-label ${id}-value`} aria-describedby={`${id}-description`}
      aria-required={required}
      aria-expanded={open} aria-haspopup="listbox" aria-controls={open ? `${id}-list` : undefined}
      aria-activedescendant={open ? `${id}-option-${active}` : undefined}
      onClick={() => { setActive(selectedIndex); setOpen((current) => !current); }}
      onKeyDown={(event) => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          setActive(open ? (active + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length : selectedIndex);
          setOpen(true);
        } else if (open && (event.key === 'Home' || event.key === 'End')) {
          event.preventDefault(); setActive(event.key === 'Home' ? 0 : options.length - 1);
        } else if (open && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault(); choose(active);
        } else if (open && event.key === 'Escape') {
          event.preventDefault(); event.stopPropagation(); setOpen(false);
        } else if (event.key === 'Tab') setOpen(false);
      }}
      className={`mt-2 flex min-h-[84px] w-full items-start justify-between gap-3 rounded-xl border bg-white px-3.5 py-3 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-[#FCF487] ${open ? 'border-black ring-2 ring-[#FCF487]' : 'border-[#D9D5C7] hover:border-[#9C9486]'}`}>
      <span className="min-w-0"><span id={`${id}-value`} className="block text-sm font-medium text-[#222]">{selected.label || selected.value}</span><span id={`${id}-description`} className="mt-1 block text-xs leading-relaxed text-[#7A7568]">{selected.description}</span></span>
      <svg aria-hidden="true" className={`mt-1 h-4 w-4 shrink-0 text-[#7A7568] transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" /></svg>
    </button>
    {open && <div id={`${id}-list`} role="listbox" aria-labelledby={`${id}-label`} className="absolute inset-x-0 top-full z-20 mt-2 max-h-72 overflow-y-auto rounded-xl border border-[#D9D5C7] bg-white p-1.5 shadow-[0_12px_32px_rgba(41,38,31,0.16)]">
      {options.map((option, index) => <div key={option.value} id={`${id}-option-${index}`} role="option" aria-selected={option.value === value}
        onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => setActive(index)} onClick={() => choose(index)}
        className={`flex cursor-pointer items-start justify-between gap-3 rounded-lg px-3 py-3 ${active === index ? 'bg-[#F7F4EC]' : ''} ${option.value === value ? 'bg-[#F2FCBC]/60' : ''}`}>
        <span><span className="block text-sm font-semibold text-[#222]">{option.label || option.value}</span><span className="mt-1 block text-xs leading-relaxed text-[#7A7568]">{option.description}</span></span>
        {option.value === value && <svg aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[#222]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m5 12 4 4L19 6" /></svg>}
      </div>)}
    </div>}
  </div>;
}
