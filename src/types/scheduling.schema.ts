import { z } from 'zod';
import { DateTimeSchema } from './common.schema.ts';

/**
 * Reason why a work order's schedule changed.
 * Discriminated union with different types of change reasons.
 */
export const ChangeReasonSchema = z.discriminatedUnion('type', [
    // Work order delayed due to dependency constraint
    z.object({
        type: z.literal('dependency'),
        dependsOnWorkOrderId: z.string(),
        dependsOnWorkOrderNumber: z.string()
    }),
    // Work order delayed due to maintenance window
    z.object({
        type: z.literal('maintenance'),
        maintenanceWindowStart: DateTimeSchema,
        maintenanceWindowEnd: DateTimeSchema
    }),
    // Work order delayed due to work center conflict
    z.object({
        type: z.literal('work_center_conflict'),
        conflictingWorkOrderId: z.string(),
        conflictingWorkOrderNumber: z.string()
    }),
    // No change occurred
    z.object({
        type: z.literal('no_change')
    })
]);

/**
 * Detailed information about a schedule change for a work order.
 */
export const ScheduleChangeSchema = z.object({
    workOrderNumber: z.string(),
    originalStartDate: DateTimeSchema,
    originalEndDate: DateTimeSchema,
    newStartDate: DateTimeSchema,
    newEndDate: DateTimeSchema,
    delayMinutes: z.number(),
    reason: ChangeReasonSchema,
    explanation: z.string()
});

/**
 * Summary statistics for a scheduling operation.
 */
export const ScheduleSummarySchema = z.object({
    totalWorkOrders: z.number().int().nonnegative(),
    changedWorkOrders: z.number().int().nonnegative(),
    unchangedWorkOrders: z.number().int().nonnegative(),
    maintenanceWorkOrders: z.number().int().nonnegative(),
    totalDelayMinutes: z.number().nonnegative()
});

/**
 * Result of scheduling operation containing updated work orders and change details.
 */
export const ScheduleResultSchema = z.object({
    scheduledWorkOrders: z.array(z.any()), // Using z.any() for WorkOrder to avoid circular dependency
    changes: z.array(ScheduleChangeSchema),
    summary: ScheduleSummarySchema
});

// Inferred types
export type ChangeReason = z.infer<typeof ChangeReasonSchema>;
export type ScheduleChange = z.infer<typeof ScheduleChangeSchema>;
export type ScheduleSummary = z.infer<typeof ScheduleSummarySchema>;
export type ScheduleResult = z.infer<typeof ScheduleResultSchema>;
