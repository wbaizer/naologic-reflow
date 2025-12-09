import { z } from 'zod';
import { DateTimeSchema, DocumentSchema } from './common.schema.ts';

// Work Order data schema
export const WorkOrderSchema = z.object({
    workOrderNumber: z.string().min(1),
    manufacturingOrderId: z.string(),
    workCenterId: z.string(),

    // Timing
    startDate: DateTimeSchema,
    endDate: DateTimeSchema,
    durationMinutes: z.number().int().positive(),

    // Constraints
    isMaintenance: z.boolean(),

    // Dependencies
    dependsOnWorkOrderIds: z.array(z.string())
}).refine(
    (data) => data.endDate >= data.startDate,
    {
        message: 'endDate must be after or equal to startDate',
        path: ['endDate']
    }
);

// Work Order document schema
export const WorkOrderDocumentSchema = DocumentSchema(
    z.literal('workOrder'),
    WorkOrderSchema
);

// Inferred types
export type WorkOrder = z.infer<typeof WorkOrderSchema>;
export type WorkOrderDocument = z.infer<typeof WorkOrderDocumentSchema>;
