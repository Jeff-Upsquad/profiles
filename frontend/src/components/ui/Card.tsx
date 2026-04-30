import type { ReactNode, HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padding?: boolean;
}

export default function Card({
  children,
  padding = true,
  className = '',
  ...rest
}: CardProps) {
  return (
    <div
      className={`rounded-[14px] border border-[#ECECEF] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-shadow duration-200 hover:shadow-[0_1px_3px_0_rgba(0,0,0,0.1),0_1px_2px_-1px_rgba(0,0,0,0.1)] ${padding ? 'p-6' : ''} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
