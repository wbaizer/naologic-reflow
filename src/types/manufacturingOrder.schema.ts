import { z } from 'zod';
import { DateTimeSchema, DocumentSchema } from './common.schema.ts';

// Manufacturing Order data schema
export const ManufacturingOrderSchema = z.object({
    manufacturingOrderNumber: z.string().min(1),
    itemId: z.string(),
    quantity: z.number().int().positive(),
    dueDate: DateTimeSchema
});

// Manufacturing Order document schema
export const ManufacturingOrderDocumentSchema = DocumentSchema(
    z.literal('manufacturingOrder'),
    ManufacturingOrderSchema
);

// Inferred types
export type ManufacturingOrder = z.infer<typeof ManufacturingOrderSchema>;
export type ManufacturingOrderDocument = z.infer<typeof ManufacturingOrderDocumentSchema>;
