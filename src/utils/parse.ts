import { DateTime } from 'luxon';
import { type ParseResult, type WorkCenter, type WorkOrder, type ManufacturingOrder, type AnyDocument, AnyDocumentSchema, ManufacturingOrderDocumentSchema, WorkCenterDocumentSchema, WorkOrderDocumentSchema } from '../types/index.ts';

/**
 * Parses a text file containing multiple JSON document objects.
 *
 * The file should contain JSON objects, one per line or separated by new lines.
 * Each object should follow the document structure:
 * ```json
 * {
 *   "docId": "...",
 *   "docType": "workOrder" | "workCenter" | "manufacturingOrder",
 *   "data": { ... }
 * }
 * ```
 *
 * All date fields should be ISO 8601 strings (e.g., "2025-01-15T08:00:00").
 *
 * @param filePath - Absolute path to the text file
 * @returns ParseResult containing typed arrays of work centers, work orders, and manufacturing orders
 * @throws {Error} If file cannot be read, JSON is invalid, or data validation fails
 */
export async function parseDataFile(filePath: string): Promise<ParseResult> {
    try {
        // Read the file using Bun's file API
        const file = Bun.file(filePath);
        const fileContent = await file.text();

        return parseDocuments(fileContent, filePath);
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to parse data file "${filePath}": ${error.message}`);
        }
        throw error;
    }
}

/**
 * Parses raw text content containing multiple JSON document objects.
 *
 * Supports two formats:
 * 1. One JSON object per line (newline-delimited JSON)
 * 2. Multiple JSON objects separated by whitespace
 *
 * @param content - Text content with JSON document objects
 * @param source - Source identifier for error messages (file path or "string input")
 * @returns ParseResult containing typed arrays
 * @throws {Error} If JSON is invalid or data validation fails
 */
export function parseDataString(content: string, source: string = 'string input'): ParseResult {
    return parseDocuments(content, source);
}

/**
 * Preprocesses a raw document by converting ISO date strings to Luxon DateTime objects
 * and ensuring docId is a valid UUID.
 *
 * @param doc - Raw document object from JSON
 * @returns Preprocessed document ready for schema validation
 */
function preprocessDocument(doc: any): any {
    // Deep clone to avoid mutations
    const processed = JSON.parse(JSON.stringify(doc));

    // Convert ISO strings to DateTime objects and ID strings to UUIDs recursively
    function convertDatesAndIds(obj: any, key?: string): any {
        if (typeof obj === 'string') {
            // Check if this is an ID field that should be a UUID
            // Handle both singular "xxxId" fields and parent key for array items "xxxIds"
            const parentIsIdArray = key && key.endsWith('Ids');
            const isIdField = key && key.endsWith('Id');

            if ((isIdField || parentIsIdArray) && !isUUID(obj)) {
                return stringToUUID(obj);
            }

            // Try to parse as ISO date
            const dt = DateTime.fromISO(obj);
            if (dt.isValid) {
                return dt;
            }
            return obj;
        } else if (Array.isArray(obj)) {
            // Pass the parent key to array items (e.g., "dependsOnWorkOrderIds")
            return obj.map((item) => convertDatesAndIds(item, key));
        } else if (obj && typeof obj === 'object') {
            const result: any = {};
            for (const objKey in obj) {
                result[objKey] = convertDatesAndIds(obj[objKey], objKey);
            }
            return result;
        }
        return obj;
    }

    // Convert all date strings and ID fields in the document
    processed.data = convertDatesAndIds(processed.data);

    // Generate UUID from docId if it's not already a UUID
    if (processed.docId && typeof processed.docId === 'string' && !isUUID(processed.docId)) {
        processed.docId = stringToUUID(processed.docId);
    }

    return processed;
}

/**
 * Checks if a string is a valid UUID.
 *
 * @param str - String to check
 * @returns true if valid UUID, false otherwise
 */
function isUUID(str: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
}

/**
 * Converts a string to a deterministic UUID v5-like format.
 *
 * @param str - Input string
 * @returns UUID string
 */
function stringToUUID(str: string): string {
    // Simple hash function to generate a deterministic UUID
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }

    // Convert to hex and pad to create UUID format
    const hex = Math.abs(hash).toString(16).padStart(8, '0');
    return `${hex.slice(0, 8)}-${hex.slice(0, 4)}-4${hex.slice(0, 3)}-8${hex.slice(0, 3)}-${hex.padEnd(12, '0').slice(0, 12)}`;
}

/**
 * Internal function to parse document objects from text content.
 *
 * @param content - Text content with JSON objects
 * @param source - Source identifier for error messages
 * @returns ParseResult with typed arrays
 */
function parseDocuments(content: string, source: string): ParseResult {
    const workCenters: WorkCenter[] = [];
    const workOrders: WorkOrder[] = [];
    const manufacturingOrders: ManufacturingOrder[] = [];

    // Split content into potential JSON objects
    // Try line-by-line first (newline-delimited JSON)
    const lines = content.trim().split('\n').filter(line => line.trim().length > 0);

    let documentCount = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]?.trim();
        if (!line) continue;

        try {
            // Parse JSON and preprocess to convert ISO strings to DateTime objects
            const rawDoc: any = JSON.parse(line);
            const preprocessedDoc = preprocessDocument(rawDoc);

            // Validate with schema
            const { success, data: doc, error } = AnyDocumentSchema.safeParse(preprocessedDoc);
            if (error) throw new Error(`Invalid document at line ${i + 1} in ${source}: ${JSON.stringify(error.issues, null, 2)}`);
            else if (!success || !doc) throw new Error(`Invalid document at line ${i + 1} in ${source}`);
            documentCount++;

            // Route to appropriate converter based on docType
            switch (doc.docType) {
                case 'workCenter':
                    workCenters.push(convertToWorkCenter(doc));
                    break;
                case 'workOrder':
                    workOrders.push(convertToWorkOrder(doc));
                    break;
                case 'manufacturingOrder':
                    manufacturingOrders.push(convertToManufacturingOrder(doc));
                    break;
                default:
                    throw new Error(`Unknown docType: "${doc.docType}"`);
            }
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(
                    `Error parsing document at line ${i + 1} in ${source}: ${error.message}`
                );
            }
            throw error;
        }
    }

    if (documentCount === 0) {
        throw new Error(`No valid JSON documents found in ${source}`);
    }

    return {
        workCenters,
        workOrders,
        manufacturingOrders
    };
}

/**
 * Validates and converts a work center document to a typed WorkCenter.
 *
 * @param doc - Document with work center data
 * @returns Typed WorkCenter object (data field only)
 * @throws {Error} If validation or date parsing fails
 */
function convertToWorkCenter(doc: AnyDocument): WorkCenter {
    const { success, data: validDoc, error } = WorkCenterDocumentSchema.safeParse(doc);
    if (error) throw new Error(`Invalid work center document: ${error.message}`);
    else if (success && doc) return validDoc.data;
    else throw new Error('Invalid work center document');

}

/**
 * Validates and converts a work order document to a typed WorkOrder.
 *
 * @param doc - Document with work order data
 * @returns Typed WorkOrder object (data field only)
 * @throws {Error} If validation or date parsing fails
 */
function convertToWorkOrder(doc: AnyDocument): WorkOrder {
    const { success, data: validDoc, error } = WorkOrderDocumentSchema.safeParse(doc);
    if (error) throw new Error(`Invalid work order document: ${error.message}`);
    else if (success && doc) return validDoc.data;
    else throw new Error('Invalid work order document');
}

/**
 * Validates and converts a manufacturing order document to a typed ManufacturingOrder.
 *
 * @param doc - Document with manufacturing order data
 * @returns Typed ManufacturingOrder object (data field only)
 * @throws {Error} If validation or date parsing fails
 */
function convertToManufacturingOrder(doc: AnyDocument): ManufacturingOrder {
    const { success, data: validDoc, error } = ManufacturingOrderDocumentSchema.safeParse(doc);
    if (error) throw new Error(`Invalid manufacturing order document: ${error.message}`);
    else if (success && doc) return validDoc.data;
    else throw new Error('Invalid manufacturing order document');
}
