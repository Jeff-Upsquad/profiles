import { type InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, id, className = '', ...rest }, ref) => {
    const inputId = id || rest.name;
    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="mb-1.5 block text-[13px] font-medium text-[#3F3F46]"
          >
            {label}
            {rest.required && <span className="ml-0.5 text-red-500">*</span>}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`block w-full rounded-lg border px-3 py-2.5 text-sm shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-all duration-200 placeholder:text-[#a3a3a3] focus:outline-none ${
            error
              ? 'border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-500/15'
              : 'border-[#E8E5DE] focus:border-[#0a0a0a] focus:ring-2 focus:ring-[#0a0a0a]/12'
          } ${rest.disabled ? 'bg-[#F7F6F3] text-[#a3a3a3] cursor-not-allowed' : 'bg-white text-[#0a0a0a]'} ${className}`}
          {...rest}
        />
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        {helperText && !error && (
          <p className="mt-1 text-xs text-[#737373]">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
export default Input;
