import { z } from 'zod';
import { WorkCenterSchema, WorkOrderSchema, ManufacturingOrderSchema } from './index.ts';

/**
 * Grouped data for a specific work center.
 * Contains only the work orders and manufacturing orders relevant to that work center.
 */
export const WorkCenterGroupSchema = z.object({
    workCenter: WorkCenterSchema,
    workOrders: z.array(WorkOrderSchema),
    // Map is not directly supported by Zod, so we use a Record for the schema
    // In practice, this will be a Map<string, ManufacturingOrder>
    manufacturingOrders: z.record(z.string(), ManufacturingOrderSchema)
});

// Inferred type
export type WorkCenterGroup = {
    workCenter: z.infer<typeof WorkCenterSchema>;
    workOrders: z.infer<typeof WorkOrderSchema>[];
    manufacturingOrders: Map<string, z.infer<typeof ManufacturingOrderSchema>>;
};
