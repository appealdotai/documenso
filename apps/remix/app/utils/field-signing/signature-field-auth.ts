import type { TRecipientActionAuth } from '@documenso/lib/types/document-auth';
import type { TSignFieldSignatureDialogResult } from '@documenso/lib/utils/signature-picker';
import { requiresSignatureActionAuth } from '@documenso/lib/utils/signature-picker';
import { FieldType } from '@prisma/client';

type ExecuteActionAuthProcedure = (options: {
  onReauthFormSubmit: (authOptions?: TRecipientActionAuth) => Promise<void> | void;
  actionTarget: typeof FieldType.SIGNATURE;
}) => Promise<void>;

type RunSignatureFieldActionOptions = {
  result: TSignFieldSignatureDialogResult;
  hasAuthedOnceThisSession: boolean;
  recipientActionAuthRequired: boolean;
  markSignatureActionAuthCompleted: () => void;
  executeActionAuthProcedure: ExecuteActionAuthProcedure;
  onApply: (authOptions?: TRecipientActionAuth) => Promise<void>;
  onRemove: (authOptions?: TRecipientActionAuth) => Promise<void>;
};

export const runSignatureFieldAction = async ({
  result,
  hasAuthedOnceThisSession,
  recipientActionAuthRequired,
  markSignatureActionAuthCompleted,
  executeActionAuthProcedure,
  onApply,
  onRemove,
}: RunSignatureFieldActionOptions) => {
  const needsAuth = requiresSignatureActionAuth({
    result,
    hasAuthedOnceThisSession,
    recipientActionAuthRequired,
  });

  const run = async (authOptions?: TRecipientActionAuth) => {
    if (result.action === 'remove') {
      await onRemove(authOptions);
      return;
    }

    await onApply(authOptions);

    if (!result.isNewSignature) {
      markSignatureActionAuthCompleted();
    }
  };

  if (!needsAuth) {
    await run();
    return;
  }

  await executeActionAuthProcedure({
    onReauthFormSubmit: async (authOptions) => {
      await run(authOptions);

      if (result.action === 'apply' && result.isNewSignature) {
        markSignatureActionAuthCompleted();
      }
    },
    actionTarget: FieldType.SIGNATURE,
  });
};
