import type { WorkOrder } from '../types/index.ts';

/**
 * Performs topological sort on work orders using Kahn's algorithm.
 *
 * Ensures that all dependency work orders come before dependent work orders
 * in the returned array. This is required for proper scheduling - a work order
 * cannot start until all its dependencies have completed.
 *
 * Algorithm (Kahn's):
 * 1. Calculate in-degree (number of dependencies) for each work order
 * 2. Start with work orders that have no dependencies (in-degree = 0)
 * 3. Process each work order, removing it from the graph and decreasing
 *    the in-degree of work orders that depend on it
 * 4. Repeat until all work orders are processed
 *
 * @param workOrders - Array of work orders to sort
 * @returns Topologically sorted array of work orders
 * @throws {Error} If circular dependencies are detected
 */
export function topologicalSort(workOrders: WorkOrder[]): WorkOrder[] {
    // Handle empty array
    if (workOrders.length === 0) {
        return [];
    }

    // Create a map for quick lookup by work order number
    const workOrderMap = new Map<string, WorkOrder>();
    workOrders.forEach(wo => {
        workOrderMap.set(wo.workOrderNumber, wo);
    });

    // Calculate in-degree (number of dependencies) for each work order
    const inDegree = new Map<string, number>();
    const adjacencyList = new Map<string, string[]>(); // Maps work order to its dependents

    // Initialize in-degree and adjacency list
    workOrders.forEach(wo => {
        inDegree.set(wo.workOrderNumber, wo.dependsOnWorkOrderIds.length);
        adjacencyList.set(wo.workOrderNumber, []);
    });

    // Build adjacency list (reverse of dependency graph)
    // For each work order, track which work orders depend on it
    workOrders.forEach(wo => {
        wo.dependsOnWorkOrderIds.forEach(depId => {
            const depList = adjacencyList.get(depId);
            if (depList) {
                depList.push(wo.workOrderNumber);
            }
        });
    });

    // Queue of work orders with no dependencies (in-degree = 0)
    const queue: string[] = [];
    inDegree.forEach((degree, woNumber) => {
        if (degree === 0) {
            queue.push(woNumber);
        }
    });

    // Result array
    const sorted: WorkOrder[] = [];

    // Process queue using Kahn's algorithm
    while (queue.length > 0) {
        // Remove work order with no dependencies
        const currentWoNumber = queue.shift()!;
        const currentWo = workOrderMap.get(currentWoNumber);

        if (!currentWo) {
            throw new Error(`Work order ${currentWoNumber} not found in work order map`);
        }

        sorted.push(currentWo);

        // Process all work orders that depend on this one
        const dependents = adjacencyList.get(currentWoNumber) || [];
        dependents.forEach(dependentWoNumber => {
            // Decrease in-degree
            const currentInDegree = inDegree.get(dependentWoNumber)!;
            inDegree.set(dependentWoNumber, currentInDegree - 1);

            // If in-degree becomes 0, add to queue
            if (currentInDegree - 1 === 0) {
                queue.push(dependentWoNumber);
            }
        });
    }

    // Check for circular dependencies
    if (sorted.length !== workOrders.length) {
        // Find work orders that weren't processed (part of cycle)
        const processedNumbers = new Set(sorted.map(wo => wo.workOrderNumber));
        const unprocessed = workOrders.filter(wo => !processedNumbers.has(wo.workOrderNumber));
        const unprocessedNumbers = unprocessed.map(wo => wo.workOrderNumber).join(', ');

        throw new Error(
            `Circular dependency detected in work orders. ` +
            `The following work orders are part of a dependency cycle: ${unprocessedNumbers}`
        );
    }

    return sorted;
}

/**
 * Validates work order dependencies without sorting.
 *
 * Checks that all referenced dependencies exist and that there are no circular dependencies.
 *
 * @param workOrders - Array of work orders to validate
 * @returns Object with validation results
 */
export function validateWorkOrderDependencies(workOrders: WorkOrder[]): {
    valid: boolean;
    missingDependencies: string[];
    circularDependencies: boolean;
    errors: string[];
} {
    const errors: string[] = [];
    const missingDependencies: string[] = [];
    const workOrderNumbers = new Set(workOrders.map(wo => wo.workOrderNumber));

    // Check for missing dependencies
    workOrders.forEach(wo => {
        wo.dependsOnWorkOrderIds.forEach(depId => {
            if (!workOrderNumbers.has(depId)) {
                missingDependencies.push(depId);
                errors.push(
                    `Work order ${wo.workOrderNumber} depends on ${depId}, which is not in the work order list`
                );
            }
        });
    });

    // Check for circular dependencies by attempting topological sort
    let circularDependencies = false;
    if (missingDependencies.length === 0) {
        try {
            topologicalSort(workOrders);
        } catch (error) {
            if (error instanceof Error && error.message.includes('Circular dependency')) {
                circularDependencies = true;
                errors.push(error.message);
            }
        }
    }

    return {
        valid: errors.length === 0,
        missingDependencies: Array.from(new Set(missingDependencies)),
        circularDependencies,
        errors
    };
}
