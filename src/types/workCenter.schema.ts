import { z } from 'zod';
import { DateTimeSchema, DocumentSchema } from './common.schema.ts';

// Shift schema
export const ShiftSchema = z.object({
    dayOfWeek: z.number().int().min(0).max(6), // 0-6, Sunday = 0
    startHour: z.number().int().min(0).max(23), // 0-23
    endHour: z.number().int().min(0).max(23)    // 0-23
});

// Maintenance window schema
export const MaintenanceWindowSchema = z.object({
    startDate: DateTimeSchema,
    endDate: DateTimeSchema,
    reason: z.string().optional()
});

// Work Center data schema
export const WorkCenterDataSchema = z.object({
    name: z.string().min(1),
    shifts: z.array(ShiftSchema),
    maintenanceWindows: z.array(MaintenanceWindowSchema)
});

// Work Center document schema
export const WorkCenterDocumentSchema = DocumentSchema(
    z.literal('workCenter'),
    WorkCenterDataSchema
);

// Inferred types
export type Shift = z.infer<typeof ShiftSchema>;
export type MaintenanceWindow = z.infer<typeof MaintenanceWindowSchema>;
export type WorkCenterData = z.infer<typeof WorkCenterDataSchema>;
export type WorkCenterDocument = z.infer<typeof WorkCenterDocumentSchema>;
