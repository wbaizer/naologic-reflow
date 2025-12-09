import { z } from 'zod';
import { DateTime } from 'luxon';

// Custom Zod type for Luxon DateTime
export const DateTimeSchema = z.custom<DateTime>(
    (val) => val instanceof DateTime && val.isValid,
    {
        message: 'Expected a valid Luxon DateTime object'
    }
);

// Document type enum
export const DocTypeSchema = z.enum(['workOrder', 'workCenter', 'manufacturingOrder']);

// Base document schema
export const DocumentSchema = <T extends z.ZodTypeAny>(docType: z.ZodLiteral<string>, dataSchema: T) =>
    z.object({
        docId: z.uuid(),
        docType: docType,
        data: dataSchema
    });
