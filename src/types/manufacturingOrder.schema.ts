import { z } from 'zod';
import { DateTimeSchema, DocumentSchema } from './common.schema.ts';

// Manufacturing Order data schema
export const ManufacturingOrderDataSchema = z.object({
    manufacturingOrderNumber: z.string().min(1),
    itemId: z.uuid(),
    quantity: z.number().int().positive(),
    dueDate: DateTimeSchema
});

// Manufacturing Order document schema
export const ManufacturingOrderDocumentSchema = DocumentSchema(
    z.literal('manufacturingOrder'),
    ManufacturingOrderDataSchema
);

// Inferred types
export type ManufacturingOrderData = z.infer<typeof ManufacturingOrderDataSchema>;
export type ManufacturingOrderDocument = z.infer<typeof ManufacturingOrderDocumentSchema>;
