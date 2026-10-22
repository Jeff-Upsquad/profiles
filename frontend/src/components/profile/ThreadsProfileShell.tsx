interface ThreadsProfileShellProps {
  children: React.ReactNode;
  /** Content rendered outside (above) the card, e.g. the top bar */
  topBar?: React.ReactNode;
  /** Right-hand column on large screens (skills, tools…). Hidden below lg. */
  rail?: React.ReactNode;
}

export default function ThreadsProfileShell({ children, topBar, rail }: ThreadsProfileShellProps) {
  return (
    <div
      className={`mx-auto w-full min-h-full pb-10 sm:px-6 sm:pt-2 ${rail ? 'max-w-[1040px]' : 'max-w-[668px]'}`}
    >
      {topBar}
      <div className="flex items-start gap-6 sm:mt-2">
        <main className="min-w-0 flex-1 overflow-hidden bg-white sm:max-w-[640px] sm:rounded-[28px] sm:border sm:border-zinc-200">
          {children}
        </main>
        {rail && (
          <aside className="hidden w-[340px] shrink-0 flex-col gap-3 lg:flex">{rail}</aside>
        )}
      </div>
    </div>
  );
}
