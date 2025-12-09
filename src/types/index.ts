import { z } from 'zod';
// Import for union type
import { WorkOrderDocumentSchema } from './workOrder.schema.ts';
import { WorkCenterDocumentSchema } from './workCenter.schema.ts';
import { ManufacturingOrderDocumentSchema } from './manufacturingOrder.schema.ts';

// Union schema for all document types
export const AnyDocumentSchema = z.discriminatedUnion('docType', [
    WorkOrderDocumentSchema,
    WorkCenterDocumentSchema,
    ManufacturingOrderDocumentSchema
]);

// Inferred union type
export type AnyDocument = z.infer<typeof AnyDocumentSchema>;
// Re-export common schemas
export * from './common.schema.ts';
export * from './workCenter.schema.ts';
export * from './workOrder.schema.ts';
export * from './manufacturingOrder.schema.ts';
export * from './scheduling.schema.ts';
export * from './parser.schema.ts';
export * from './workCenterGroup.schema.ts';