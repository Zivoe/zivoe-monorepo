import { ReactNode } from 'react';

export default function InfoSection({
  title,
  icon,
  children
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <div className="flex w-fit items-center justify-center rounded-[4px] bg-element-primary-gentle p-[5px] [&_svg]:size-4 [&_svg]:text-brand">
          {icon}
        </div>

        <p className="text-h7 text-primary">{title}</p>
      </div>

      {children}
    </div>
  );
}
