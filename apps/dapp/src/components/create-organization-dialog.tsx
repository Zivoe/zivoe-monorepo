'use client';

import { useMutation } from '@tanstack/react-query';

import { Callout } from '@zivoe/ui/core/callout';
import { DialogContent, DialogContentBox, DialogHeader, DialogTitle } from '@zivoe/ui/core/dialog';
import { toast } from '@zivoe/ui/core/sonner';

import { createOrganization } from '@/server/actions/organizations';

import { ORGANIZATION_ERROR_COPY } from '@/lib/organization-copy';
import { type OrganizationDetailsFormData } from '@/lib/schemas/organizations';

import { OrganizationDetailsForm } from '@/components/organization-details-form';

/**
 * "Create organization", wherever it is offered: the Settings navigation and the `/verification` account
 * switcher. Controlled, so a menu item can open it. `onCreated` decides where the new organization leads.
 */
export function CreateOrganizationDialog({
  isOpen,
  onOpenChange,
  onCreated
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onCreated: (organizationId: string) => void;
}) {
  const create = useMutation({
    mutationFn: (data: OrganizationDetailsFormData) => createOrganization(data),
    onSuccess: (result, data) => {
      if (!result.ok) return;
      toast({ type: 'success', title: `${data.name} created` });
      onOpenChange(false);
      onCreated(result.value.organizationId);
    }
  });
  const refusal = create.data && !create.data.ok ? ORGANIZATION_ERROR_COPY[create.data.error.code] : null;

  return (
    <DialogContent
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) create.reset();
        onOpenChange(open);
      }}
      aria-label="Create organization"
    >
      <DialogContentBox>
        <DialogHeader className="p-0 pr-12">
          <DialogTitle>Create organization</DialogTitle>
        </DialogHeader>

        {refusal || create.isError ? (
          <Callout variant="warning" role="alert">
            {refusal ?? ORGANIZATION_ERROR_COPY.failed}
          </Callout>
        ) : null}

        <OrganizationDetailsForm
          submitLabel="Create organization"
          isPending={create.isPending}
          onSubmit={(data) => create.mutate(data)}
        />
      </DialogContentBox>
    </DialogContent>
  );
}
