import React from 'react';

export function Separator({ children }: { children?: React.ReactNode }) {
  return (
    <div className="text-small text-primary flex w-full items-center gap-3">
      <div className="bg-surface-elevated-emphasis h-px flex-1" />
      {children && (
        <>
          {children} <div className="bg-surface-elevated-emphasis h-px flex-1" />
        </>
      )}
    </div>
  );
}
