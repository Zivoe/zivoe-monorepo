import { type IconProps } from '@zivoe/ui/icons/types';

export function LighthouseIcon(props: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="40"
      height="44"
      viewBox="0 0 40 44"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="m13 9 7-5 7 5M12 10h16M14 10v8h12v-8M12 18h16M15 18l-4 21h18l-4-21M9 39h22M8 42h24" />
      <path d="M18 10v8m4-8v8m-8 6h12m-13 7h14m-9 8v-5h4v5M4 9l5 2M3 16l6-1m22-4 5-2m-5 6 6 1" />
    </svg>
  );
}
