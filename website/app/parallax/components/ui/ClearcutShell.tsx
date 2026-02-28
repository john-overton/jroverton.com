import type { ReactNode } from 'react';

interface ClearcutShellProps {
  children: ReactNode;
  sidebar: ReactNode;
  filterBar?: ReactNode;
}

export default function ClearcutShell({ children, sidebar, filterBar }: ClearcutShellProps) {
  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="w-56 shrink-0 flex flex-col border-r border-cc-border bg-cc-surface-1 shadow-[2px_0_6px_rgba(0,0,0,0.08)] z-10">
        {sidebar}
      </aside>
      <div className="flex-1 flex flex-col overflow-hidden">
        {filterBar && (
          <div className="shrink-0 border-b border-cc-border bg-cc-surface-1 relative z-20">
            {filterBar}
          </div>
        )}
        <main className="flex-1 overflow-y-auto px-6 py-5">
          {children}
        </main>
      </div>
    </div>
  );
}
