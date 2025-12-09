import { parseDataFile } from '../utils/parse.ts';
import { groupByWorkCenter } from '../manager/index.ts';
import { topologicalSort } from './topological-sort.ts';
import { ShiftCalendar } from '../utils/shift-calendar.ts';
import type { ScheduleResult } from '../types/index.ts';

/**
 * Result of the reflow operation for a single work center.
 */
interface WorkCenterReflowResult {
    workCenterName: string;
    scheduleResult: ScheduleResult;
    sortedWorkOrderNumbers: string[];
}

/**
 * Complete result of the reflow operation for all work centers.
 */
interface ReflowResult {
    workCenterResults: WorkCenterReflowResult[];
    summary: {
        totalWorkCenters: number;
        totalWorkOrders: number;
        totalChanges: number;
        totalDurationMinutes: number;
        totalDelayMinutes: number;
    };
}

/**
 * Main reflow service that orchestrates the entire scheduling process.
 *
 * Flow:
 * 1. Parse data file - get work centers, work orders, manufacturing orders
 * 2. Group by work center - filter relevant work orders and MOs per work center
 * 3. Topologically sort work orders - ensure dependencies are satisfied
 * 4. Schedule with ShiftCalendar - produce valid schedule with change tracking
 *
 * @param filePath - Path to the data file (JSONL format with document objects)
 * @returns ReflowResult with scheduling results for all work centers
 * @throws {Error} If parsing fails, circular dependencies detected, or scheduling fails
 */
export async function reflowFromFile(filePath: string): Promise<void> {
    // Step 1: Parse data file
    const parseResult = await parseDataFile(filePath);

    // Step 2: Group by work center
    const workCenterGroups = groupByWorkCenter(
        parseResult.workCenters,
        parseResult.workOrders,
        parseResult.manufacturingOrders
    );

    // Step 3 & 4: Sort and schedule each work center
    const workCenterResults: WorkCenterReflowResult[] = [];

    for (const group of workCenterGroups) {
        // Skip work centers with no work orders
        if (group.workOrders.length === 0) continue;

        // Step 3: Topological sort
        const sortedWorkOrders = topologicalSort(group.workOrders);

        // Step 4: Schedule with ShiftCalendar
        const calendar = new ShiftCalendar(group.workCenter);
        const scheduleResult = calendar.schedule(sortedWorkOrders);

        workCenterResults.push({
            workCenterName: group.workCenter.name,
            scheduleResult,
            sortedWorkOrderNumbers: sortedWorkOrders.map(wo => wo.workOrderNumber)
        });
    }

    // Calculate summary statistics
    const totalWorkOrders = workCenterResults.reduce(
        (sum, result) => sum + result.scheduleResult.summary.totalWorkOrders,
        0
    );
    const totalChanges = workCenterResults.reduce(
        (sum, result) => sum + result.scheduleResult.summary.changedWorkOrders,
        0
    );
    const totalDurationMinutes = workCenterResults.reduce(
        (sum, result) => sum + result.scheduleResult.summary.totalDurationMinutes,
        0
    );

    const oldDurationMinutes = workCenterResults.reduce(
        (sum, result) => sum + result.scheduleResult.summary.oldDurationMinutes,
        0
    );

    printReflowSummary({
        workCenterResults,
        summary: {
            totalWorkCenters: workCenterResults.length,
            totalWorkOrders,
            totalChanges,
            totalDurationMinutes,
            totalDelayMinutes: oldDurationMinutes - totalDurationMinutes,
        }
    });
}

/**
 * Prints a human-readable summary of the reflow results.
 *
 * @param result - ReflowResult to summarize
 */
function printReflowSummary(result: ReflowResult): void {
    console.log('\n=== Reflow Summary ===');
    console.log(`Total Work Centers: ${result.summary.totalWorkCenters}`);
    console.log(`Total Work Orders: ${result.summary.totalWorkOrders}`);
    console.log(`Work Orders Changed: ${result.summary.totalChanges}`);
    console.log(`Total Duration: ${Math.floor(result.summary.totalDurationMinutes / 60)}h ${result.summary.totalDurationMinutes % 60}m`);
    console.log(`Total Delay: ${Math.floor(result.summary.totalDelayMinutes / 60)}h ${result.summary.totalDelayMinutes % 60}m`);

    result.workCenterResults.forEach(wcResult => {
        console.log(`\n--- ${wcResult.workCenterName} ---`);
        console.log(`Work Orders: ${wcResult.scheduleResult.summary.totalWorkOrders}`);
        console.log(`Changed: ${wcResult.scheduleResult.summary.changedWorkOrders}`);
        console.log(`Maintenance Orders: ${wcResult.scheduleResult.summary.maintenanceWorkOrders}`);
        console.log(`Duration: ${Math.floor(wcResult.scheduleResult.summary.totalDurationMinutes / 60)}h ${wcResult.scheduleResult.summary.totalDurationMinutes % 60}m`);

        console.log('\nExecution Order:');
        wcResult.sortedWorkOrderNumbers.forEach((woNumber, index) => {
            console.log(`  ${index + 1}. ${woNumber}`);
        });

        console.log('\nSchedule Changes:');
        wcResult.scheduleResult.changes.forEach(change => {
            if (change.delayMinutes > 0) {
                console.log(`  ${change.workOrderNumber}:`);
                console.log(`    ${change.explanation}`);
                console.log(`    New: ${change.newStartDate.toISO()} � ${change.newEndDate.toISO()}`);
            }
        });
    });

    console.log('\n======================\n');
}
