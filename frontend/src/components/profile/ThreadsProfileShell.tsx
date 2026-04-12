interface ThreadsProfileShellProps {
  children: React.ReactNode;
}

export default function ThreadsProfileShell({ children }: ThreadsProfileShellProps) {
  return (
    <div className="mx-auto w-full max-w-[620px] min-h-full bg-[var(--threads-bg)] border-x border-[var(--threads-border)] sm:border-x max-sm:border-x-0">
      {children}
    </div>
  );
}
