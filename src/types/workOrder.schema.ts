import { z } from 'zod';
import { DateTimeSchema, DocumentSchema } from './common.schema.ts';

// Work Order data schema
export const WorkOrderDataSchema = z.object({
    workOrderNumber: z.string().min(1),
    manufacturingOrderId: z.uuid(),
    workCenterId: z.uuid(),

    // Timing
    startDate: DateTimeSchema,
    endDate: DateTimeSchema,
    durationMinutes: z.number().int().positive(),

    // Constraints
    isMaintenance: z.boolean(),

    // Dependencies
    dependsOnWorkOrderIds: z.array(z.uuid())
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
    WorkOrderDataSchema
);

// Inferred types
export type WorkOrderData = z.infer<typeof WorkOrderDataSchema>;
export type WorkOrderDocument = z.infer<typeof WorkOrderDocumentSchema>;
