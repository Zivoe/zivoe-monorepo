'use client';

import { useEffect, useState } from 'react';

import { useRouter } from 'next/navigation';

import { useDynamicContext } from '@dynamic-labs/sdk-react-core';

import { Button } from '@zivoe/ui/core/button';
import { Dialog, DialogContent, DialogContentBox } from '@zivoe/ui/core/dialog';
import { Link } from '@zivoe/ui/core/link';
import { toast } from '@zivoe/ui/core/sonner';
import { LockIcon } from '@zivoe/ui/icons';

import { useChainalysis } from '@/hooks/useChainalysis';

export default function ChainalysisAssessmentDialog() {
  const router = useRouter();

  const { handleLogOut } = useDynamicContext();

  const assessment = useChainalysis();

  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleDisconnect = async () => {
    try {
      await handleLogOut();
    } catch (error) {
      console.error(error);
      toast({ type: 'error', title: 'Error disconnecting wallet' });
    }

    setIsDialogOpen(false);
  };

  useEffect(() => {
    if (assessment.isRiskyAddress) {
      setIsDialogOpen(true);
    }
  }, [assessment.isRiskyAddress, router]);

  return (
    <Dialog isOpen={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogContent isDismissable={false}>
        <DialogContentBox className="p-4">
          <div className="flex flex-col items-center gap-6 py-3">
            <div className="flex size-12 items-center justify-center rounded-md bg-element-alert-light">
              <LockIcon className="size-8 text-alert-contrast" />
            </div>

            <div className="flex max-w-[28rem] flex-col items-center gap-3 text-center">
              <p className="text-h5 text-primary">Wallet Connection Denied</p>

              <p className="text-regular text-secondary">
                We've detected irregular or sanctioned activity associated with the wallet you attempted to connect.
                This may affect your ability to interact with our services. If you believe this is a mistake, please
                contact us at{' '}
                <Link
                  variant="link-neutral-dark"
                  size="m"
                  href="mailto:inquire@zivoe.com"
                  target="_blank"
                  hideExternalLinkIcon
                >
                  inquire@zivoe.com
                </Link>{' '}
                for further assistance.
              </p>
            </div>
          </div>

          {assessment.data?.riskReason && (
            <div className="flex w-full flex-col gap-1 rounded-md bg-surface-elevated px-4 py-3">
              <p className="text-regular font-medium text-primary">Denial reason</p>
              <p className="text-small text-secondary">{assessment.data?.riskReason}</p>
            </div>
          )}

          <div className="flex w-full flex-wrap gap-4 sm:flex-nowrap">
            <Link fullWidth variant="border-light" href="https://zivoe.com" target="_blank">
              Back to Homepage
            </Link>

            <Button fullWidth onPress={handleDisconnect}>
              Disconnect
            </Button>
          </div>
        </DialogContentBox>
      </DialogContent>
    </Dialog>
  );
}
