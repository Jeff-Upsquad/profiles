import { type ButtonHTMLAttributes, type ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children: ReactNode;
}

const variantStyles: Record<Variant, string> = {
  primary:
    'bg-[#202020] text-white hover:bg-[#202020]/85 focus-visible:ring-[#202020]/30',
  secondary:
    'bg-[#f0f0f0] text-[#202020] hover:bg-[#dedede] focus-visible:ring-[#202020]/15',
  danger:
    'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500/30',
  ghost:
    'bg-transparent text-[#646464] hover:bg-[#f0f0f0] focus-visible:ring-[#202020]/15',
  outline:
    'border border-[#E4E4E7] bg-transparent text-[#202020] hover:bg-[#f0f0f0] focus-visible:ring-[#202020]/15',
};

const sizeStyles: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-[13px] rounded-lg',
  md: 'px-4 py-2 text-sm rounded-[10px]',
  lg: 'px-5 py-2.5 text-[15px] rounded-xl',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  className = '',
  ...rest
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`font-[family-name:var(--font-inter)] inline-flex items-center justify-center gap-1.5 font-semibold tracking-[-0.01em] transition-all duration-200 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...rest}
    >
      {loading && (
        <svg
          className="h-3.5 w-3.5 animate-spin"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      )}
      {children}
    </button>
  );
}
