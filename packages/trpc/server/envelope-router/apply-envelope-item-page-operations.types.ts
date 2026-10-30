import { ZEnvelopeFieldSchema } from '@documenso/lib/types/field';
import EnvelopeItemSchema from '@documenso/prisma/generated/zod/modelSchema/EnvelopeItemSchema';
import { z } from 'zod';
import { zfd } from 'zod-form-data';

import { zfdFile, zodFormData } from '../../utils/zod-form-data';

export const ZEnvelopeItemPageOperationSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('remove'),
    pageIndex: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('move'),
    fromIndex: z.number().int().nonnegative(),
    toIndex: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('duplicate'),
    pageIndex: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('import'),
    pageIndices: z.array(z.number().int().nonnegative()).min(1).max(1000),
    insertAt: z.number().int().nonnegative(),
  }),
]);

export const ZApplyEnvelopeItemPageOperationsPayloadSchema = z.object({
  envelopeId: z.string(),
  envelopeItemId: z.string(),
  operations: z.array(ZEnvelopeItemPageOperationSchema).min(1).max(1000),
});

export const ZApplyEnvelopeItemPageOperationsRequestSchema = zodFormData({
  payload: zfd.json(ZApplyEnvelopeItemPageOperationsPayloadSchema),
  file: zfdFile().optional(),
});

export const ZApplyEnvelopeItemPageOperationsResponseSchema = z.object({
  data: EnvelopeItemSchema.pick({
    id: true,
    title: true,
    envelopeId: true,
    order: true,
    documentDataId: true,
  }),
  fields: ZEnvelopeFieldSchema.array(),
});

export type TEnvelopeItemPageOperation = z.infer<typeof ZEnvelopeItemPageOperationSchema>;
export type TApplyEnvelopeItemPageOperationsPayload = z.infer<typeof ZApplyEnvelopeItemPageOperationsPayloadSchema>;
export type TApplyEnvelopeItemPageOperationsRequest = z.infer<typeof ZApplyEnvelopeItemPageOperationsRequestSchema>;
export type TApplyEnvelopeItemPageOperationsResponse = z.infer<typeof ZApplyEnvelopeItemPageOperationsResponseSchema>;
