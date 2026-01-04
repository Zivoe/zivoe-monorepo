import { Button } from '@zivoe/ui/core/button';
import { Link, LinkProps } from '@zivoe/ui/core/link';
import { SelectTrigger, SelectValue } from '@zivoe/ui/core/select';
import { ArrowLeftIcon } from '@zivoe/ui/icons';
import { cn } from '@zivoe/ui/lib/tw-utils';

import { LINKS } from '@/types/constants';

import { EMAILS } from '@/server/utils/emails/config';

function Container({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex w-full max-w-[37rem] flex-1 flex-col items-center">
      {/* Top spacer for small height screens */}
      <div className="min-h-11 flex-1" />

      <div className="flex w-full flex-col gap-11">{children}</div>

      {/* Bottom spacer for small height screens */}
      <div className="min-h-6 flex-1" />
    </div>
  );
}

Container.displayName = 'Auth.Container';

function Header({
  title,
  description,
  children
}: {
  title: string;
  description: React.ReactNode | string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex w-full flex-col gap-10">
      {children}

      <div className="flex flex-col gap-4">
        <h1 className="text-h5 text-neutral-900">{title}</h1>
        {typeof description === 'string' ? <p className="text-regular text-secondary">{description}</p> : description}
      </div>
    </div>
  );
}

Header.displayName = 'Auth.Header';

function StepIndicator({ onBack, children }: { onBack?: () => void; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4">
      {onBack && (
        <Button variant="link-primary" onPress={onBack} className="font-medium">
          <ArrowLeftIcon className="size-4" />
          <span className="text-leading font-medium">Back</span>
        </Button>
      )}

      <span className="text-leading text-secondary">{children}</span>
    </div>
  );
}

StepIndicator.displayName = 'Auth.StepIndicator';

function AuthSelectTrigger({
  className,
  children,
  isInvalid
}: {
  className?: string;
  children?: React.ReactNode;
  isInvalid?: boolean;
}) {
  return (
    <SelectTrigger
      variant="border-light"
      fullWidth
      className={cn('h-12 justify-between bg-surface-base-soft px-4', className)}
      isInvalid={isInvalid}
    >
      {children}
    </SelectTrigger>
  );
}

AuthSelectTrigger.displayName = 'Auth.SelectTrigger';

function TermsFooter() {
  return (
    <Footer>
      By clicking continue, you agree to our{' '}
      <FooterLink href={LINKS.TERMS_OF_USE}>Terms of Use & Privacy Policy</FooterLink>, comply with our{' '}
      <FooterLink href={LINKS.REG_S_COMPLIANCE}>Reg S Compliance Policy</FooterLink>, and consent to receive
      communications from Zivoe.
    </Footer>
  );
}

TermsFooter.displayName = 'Auth.TermsFooter';

function HelpFooter() {
  return (
    <Footer>
      Need help? Contact us at{' '}
      <FooterLink variant="link-primary" href={`mailto:${EMAILS.INVESTORS}`}>
        {EMAILS.INVESTORS}
      </FooterLink>
    </Footer>
  );
}

HelpFooter.displayName = 'Auth.HelpFooter';

function Footer({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex max-w-[36.7rem] justify-center py-5">
      <p className="text-center text-small text-tertiary">{children}</p>
    </div>
  );
}

Footer.displayName = 'Auth.Footer';

function FooterLink({
  variant = 'link-tertiary',
  href,
  children
}: {
  variant?: LinkProps['variant'];
  href: string;
  children: string;
}) {
  return (
    <Link
      href={href}
      target="_blank"
      hideExternalLinkIcon
      variant={variant}
      size="s"
      className="hover:underline-offset-4"
    >
      {children}
    </Link>
  );
}

export const Auth = {
  Container,
  Header,
  StepIndicator,
  SelectTrigger: AuthSelectTrigger,
  TermsFooter,
  HelpFooter
};
