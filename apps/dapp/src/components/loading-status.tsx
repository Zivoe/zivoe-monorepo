/**
 * What a `loading.tsx` says to assistive tech. Its skeleton is `aria-hidden`
 * shapes, so without this line a screen reader meets a silent page until the
 * content arrives.
 */
export default function LoadingStatus() {
  return (
    <p role="status" className="sr-only">
      Loading
    </p>
  );
}
