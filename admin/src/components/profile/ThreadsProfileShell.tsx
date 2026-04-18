interface ThreadsProfileShellProps {
  children: React.ReactNode;
  /** Content rendered outside (above) the card, e.g. the top bar */
  topBar?: React.ReactNode;
}

export default function ThreadsProfileShell({ children, topBar }: ThreadsProfileShellProps) {
  return (
    <div className="mx-auto w-full max-w-[620px] min-h-full pb-10">
      {topBar}
      <div className="bg-white border border-zinc-200 rounded-[28px] overflow-hidden shadow-sm sm:mx-2 mt-2">
        {children}
      </div>
    </div>
  );
}
