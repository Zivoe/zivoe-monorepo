import { leaveInsightsPreview } from '../actions';

type LeavePreviewBannerProps = {
  message: string;
  redirectTo: string;
};

export function LeavePreviewBanner({ message, redirectTo }: LeavePreviewBannerProps) {
  const leavePreviewAction = leaveInsightsPreview.bind(null, redirectTo);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[6px] bg-element-warning-light px-4 py-3 text-small text-warning">
      <span>{message}</span>
      <form action={leavePreviewAction}>
        <button
          type="submit"
          className="cursor-pointer border-0 bg-transparent p-0 text-inherit underline decoration-current underline-offset-4"
        >
          Leave preview
        </button>
      </form>
    </div>
  );
}
