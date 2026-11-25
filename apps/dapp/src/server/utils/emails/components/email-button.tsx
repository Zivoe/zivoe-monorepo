import { Link, Section } from '@react-email/components';

/**
 * The primary call to action every email shares, centered in its own section.
 * `inline-block` keeps the padding in clients that ignore it on inline links.
 * `skipInText` leaves the button out of the plain-text part, for emails that
 * write the link out below it instead.
 */
export function EmailButton({ href, label, skipInText }: { href: string; label: string; skipInText?: boolean }) {
  return (
    <Section className="my-8 text-center">
      <Link
        href={href}
        data-skip-in-text={skipInText ? 'true' : undefined}
        className="rounded-lg bg-primary-600 px-6 py-3 font-medium text-neutral-0"
        style={{ display: 'inline-block' }}
      >
        {label}
      </Link>
    </Section>
  );
}
