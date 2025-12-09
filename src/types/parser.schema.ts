import { z } from 'zod';
import { WorkCenterSchema } from './workCenter.schema.ts';
import { WorkOrderSchema } from './workOrder.schema.ts';
import { ManufacturingOrderSchema } from './manufacturingOrder.schema.ts';

/**
 * Result of parsing a data file containing work centers, work orders, and manufacturing orders.
 */
export const ParseResultSchema = z.object({
    workCenters: z.array(WorkCenterSchema),
    workOrders: z.array(WorkOrderSchema),
    manufacturingOrders: z.array(ManufacturingOrderSchema)
});

// Inferred type
export type ParseResult = z.infer<typeof ParseResultSchema>;
