import React, { PropsWithoutRef } from 'react';

export function fixedForwardRef<T, P = {}>(
  render: (props: PropsWithoutRef<P>, ref: React.Ref<T>) => React.ReactNode
): (props: P & React.RefAttributes<T>) => React.ReactNode {
  return React.forwardRef(render) as any;
}
