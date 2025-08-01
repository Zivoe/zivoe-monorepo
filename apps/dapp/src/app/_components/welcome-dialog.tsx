'use client';

import { useState } from 'react';

import { Button } from '@zivoe/ui/core/button';
import { Dialog, DialogContent, DialogContentBox } from '@zivoe/ui/core/dialog';
import { Link } from '@zivoe/ui/core/link';
import { ZivoeLogoIcon } from '@zivoe/ui/icons';

export default function WelcomeDialog() {
  const alreadyVisited = localStorage.getItem('zivoe-terms-accepted') === 'true';

  const [isOpen, setIsOpen] = useState(true);

  const handleAccept = () => {
    localStorage.setItem('zivoe-terms-accepted', 'true');
    setIsOpen(false);
  };

  if (alreadyVisited) return null;

  return (
    <Dialog isOpen={isOpen} onOpenChange={setIsOpen}>
      <DialogContent isDismissable={false}>
        <DialogContentBox className="p-4">
          <div className="flex flex-col items-center gap-6 py-3">
            <ZivoeLogoIcon />

            <div className="flex max-w-[27rem] flex-col items-center gap-3 text-center">
              <p className="text-h5 text-primary">Welcome to Zivoe</p>

              <p className="text-regular text-secondary">
                By clicking continue, you have read and agree to our{' '}
                <TermsLink href="https://docs.zivoe.com/terms/terms-of-use-privacy-policy">Terms of Use</TermsLink>,{' '}
                <TermsLink href="https://docs.zivoe.com/terms/terms-of-use-privacy-policy">Privacy Policy</TermsLink>,
                and <TermsLink href="https://docs.zivoe.com/terms/reg-s-compliance">Reg S Compliance Policy</TermsLink>.
              </p>
            </div>
          </div>

          <Button fullWidth onPress={handleAccept}>
            Continue
          </Button>
        </DialogContentBox>
      </DialogContent>
    </Dialog>
  );
}

function TermsLink({ href, children }: { href: string; children: string }) {
  return (
    <Link variant="link-neutral-dark" size="m" target="_blank" hideExternalLinkIcon href={href}>
      {children}
    </Link>
  );
}
