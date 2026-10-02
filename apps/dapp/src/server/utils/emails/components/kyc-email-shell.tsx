import { Heading, Link, Section, Text } from '@react-email/components';

import { EmailLayout } from './email-layout';

/**
 * The shape every KYC status email shares: a heading, a greeting, body
 * paragraphs and one button to the verification page. Transactional —
 * no unsubscribe link, no marketing disclosure, and never a token in the
 * URL: the page authenticates the reader itself.
 */
export function KycEmailShell({
  preview,
  heading,
  name,
  paragraphs,
  cta,
  footnote
}: {
  preview: string;
  heading: string;
  name?: string;
  paragraphs: Array<string>;
  cta: { label: string; href: string };
  footnote?: string;
}) {
  const greeting = name ? `Hi ${name},` : 'Hi there,';

  return (
    <EmailLayout preview={preview}>
      <Heading className="font-serif text-2xl m-0 mb-6 text-center font-semibold text-neutral-950">{heading}</Heading>

      <Text className="m-0 mb-4 leading-6 text-neutral-600">{greeting}</Text>

      {paragraphs.map((paragraph) => (
        <Text key={paragraph.slice(0, 32)} className="m-0 mb-4 leading-6 text-neutral-600">
          {paragraph}
        </Text>
      ))}

      <Section className="my-8 text-center">
        <Link
          href={cta.href}
          className="rounded-lg bg-primary-600 px-6 py-3 font-medium text-neutral-0"
          style={{ display: 'inline-block' }}
        >
          {cta.label}
        </Link>
      </Section>

      {footnote ? <Text className="text-sm m-0 text-center leading-5 text-neutral-500">{footnote}</Text> : null}
    </EmailLayout>
  );
}
