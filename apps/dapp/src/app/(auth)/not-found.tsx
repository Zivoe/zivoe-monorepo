import { Link } from '@zivoe/ui/core/link';

import { Auth } from './_components/common';

/** Inside the sign-in layout: a malformed invitation link. */
export default function AuthNotFound() {
  return (
    <div className="flex h-full flex-col items-center">
      <Auth.Container>
        <Auth.Header
          title="This page isn't available"
          description="The link may be wrong. Check it, or ask whoever invited you to send it again."
        />
        <Link variant="ghost-light" fullWidth href="/">
          Go to the dashboard
        </Link>
      </Auth.Container>

      <Auth.HelpFooter />
    </div>
  );
}
