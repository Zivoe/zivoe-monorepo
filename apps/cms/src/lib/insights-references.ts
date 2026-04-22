import type { CollectionConfig, Where } from 'payload';

type BeforeDeleteHook = NonNullable<NonNullable<CollectionConfig['hooks']>['beforeDelete']>[number];

type InsightReferenceCheck = {
  collection: 'authors' | 'insightsPosts';
  label: string;
  where: (id: number | string) => Where;
};

async function countReferences(
  args: Parameters<BeforeDeleteHook>[0],
  where: Where,
  collection: InsightReferenceCheck['collection']
) {
  const { totalDocs } = await args.req.payload.count({
    collection,
    req: args.req,
    where
  });

  return totalDocs;
}

export function preventInsightReferenceDeletion(
  referenceLabel: string,
  checks: Array<Pick<InsightReferenceCheck, 'collection' | 'label' | 'where'>>
): BeforeDeleteHook {
  return async (args) => {
    const blockingChecks = await Promise.all(
      checks.map(async (check) => ({
        ...check,
        totalDocs: await countReferences(args, check.where(args.id), check.collection)
      }))
    );

    const blockingReference = blockingChecks.find((check) => check.totalDocs > 0);

    if (!blockingReference) {
      return;
    }

    throw new Error(
      `Cannot delete this ${referenceLabel} because it is still referenced by ${blockingReference.totalDocs} ${blockingReference.label}.`
    );
  };
}
