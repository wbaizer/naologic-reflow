import type { WorkCenter, WorkOrder, ManufacturingOrder, WorkCenterGroup } from '../types/index.ts';

/**
 * Groups work orders and manufacturing orders by work center.
 *
 * For each work center:
 * - Filters work orders where workCenterId matches the work center name
 * - Filters manufacturing orders that are referenced by those work orders
 * - Returns a map of manufacturing orders keyed by their manufacturingOrderNumber
 *
 * @param workCenters - Array of all work centers
 * @param workOrders - Array of all work orders
 * @param manufacturingOrders - Array of all manufacturing orders
 * @returns Array of WorkCenterGroup objects, one per work center
 */
export function groupByWorkCenter(
    workCenters: WorkCenter[],
    workOrders: WorkOrder[],
    manufacturingOrders: ManufacturingOrder[]
): WorkCenterGroup[] {
    // Create a lookup map for manufacturing orders for efficient access
    const manufacturingOrderMap = new Map<string, ManufacturingOrder>();
    manufacturingOrders.forEach(mo => {
        manufacturingOrderMap.set(mo.manufacturingOrderNumber, mo);
    });

    // Group data by work center
    return workCenters.map(workCenter => {
        // Filter work orders for this work center
        const relevantWorkOrders = workOrders.filter(
            wo => wo.workCenterId === workCenter.name
        );

        // Collect unique manufacturing order IDs from the work orders
        const referencedManufacturingOrderIds = new Set<string>();
        relevantWorkOrders.forEach(wo => {
            referencedManufacturingOrderIds.add(wo.manufacturingOrderId);
        });

        // Build map of referenced manufacturing orders
        const relevantManufacturingOrders = new Map<string, ManufacturingOrder>();
        referencedManufacturingOrderIds.forEach(moId => {
            const mo = manufacturingOrderMap.get(moId);
            if (mo) {
                relevantManufacturingOrders.set(mo.manufacturingOrderNumber, mo);
            }
        });

        return {
            workCenter,
            workOrders: relevantWorkOrders,
            manufacturingOrders: relevantManufacturingOrders
        };
    });
}

/**
 * Gets a single work center group by work center name.
 *
 * Convenience function to get data for a specific work center without
 * having to group all work centers first.
 *
 * @param workCenterName - Name of the work center to find
 * @param workCenters - Array of all work centers
 * @param workOrders - Array of all work orders
 * @param manufacturingOrders - Array of all manufacturing orders
 * @returns WorkCenterGroup for the specified work center, or null if not found
 */
export function getWorkCenterGroup(
    workCenterName: string,
    workCenters: WorkCenter[],
    workOrders: WorkOrder[],
    manufacturingOrders: ManufacturingOrder[]
): WorkCenterGroup | null {
    const workCenter = workCenters.find(wc => wc.name === workCenterName);
    if (!workCenter) {
        return null;
    }

    const groups = groupByWorkCenter([workCenter], workOrders, manufacturingOrders);
    return groups[0] || null;
}
