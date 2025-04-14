import React from 'react';

export function Separator({ children }: { children?: React.ReactNode }) {
  return (
    <div className="flex w-full items-center gap-2 text-small text-primary">
      <div className="h-[1px] flex-1 bg-surface-elevated-emphasis" />
      {children && (
        <>
          {children} <div className="h-[1px] flex-1 bg-surface-elevated-emphasis" />
        </>
      )}
    </div>
  );
}
