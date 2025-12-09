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
            // Try to parse as JSON
            const { success, data: doc, error } = AnyDocumentSchema.safeParse(JSON.parse(line));
            if (error) throw new Error(`Invalid document at line ${i + 1} in ${source}: ${error.message}`);
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
