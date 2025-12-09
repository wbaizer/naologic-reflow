import { DateTime } from 'luxon';
import type { WorkOrder, WorkCenter, ChangeReason, ScheduleChange, ScheduleResult } from '../types/index.ts';
import { ShiftCalculator } from './shift-calculator.ts';

/**
 * PROMPT USED TO START FILE:
Now build a file called shift-calendar which will take in a list of work orders that have been ordered and uses a shiftCalculator for a workcenter to produce:
    - Valid schedule with updated dates
    - List of changes (what moved, by how much)
    - Explanation (why it changed)
    - These are likely either due to having to be placed after a dependency work order and/or paused due for maintenance order
Place all types in the types folder using zod.
 */

/**
 * Internal structure to track work order scheduling state.
 */
interface WorkOrderScheduleState {
    workOrder: WorkOrder;
    scheduledStartDate: DateTime;
    scheduledEndDate: DateTime;
    isScheduled: boolean;
}

/**
 * ShiftCalendar schedules work orders for a work center, respecting:
 * - Work center shift schedules
 * - Maintenance windows
 * - Work order dependencies
 * - No overlapping work orders on the same work center
 *
 * Produces a valid schedule with detailed change tracking and explanations.
 */
export class ShiftCalendar {
    private readonly workCenter: WorkCenter;
    private readonly shiftCalculator: ShiftCalculator;

    /**
     * Creates a new ShiftCalendar for the given work center.
     *
     * @param workCenter - The work center to schedule work orders for
     */
    constructor(workCenter: WorkCenter) {
        this.workCenter = workCenter;
        this.shiftCalculator = new ShiftCalculator(workCenter);
    }

    /**
     * Schedules a list of work orders, producing a valid schedule with change tracking.
     *
     * The work orders should be pre-sorted in the desired scheduling order.
     *
     * Algorithm:
     * 1. Validate all work orders belong to this work center
     * 2. Separate maintenance orders (cannot be rescheduled) from regular orders
     * 3. For each work order in order:
     *    a. Check dependency constraints (all parents must complete first)
     *    b. Check work center availability (no overlaps with already scheduled work)
     *    c. Find next valid start time considering shifts and maintenance windows
     *    d. Calculate end date using ShiftCalculator
     *    e. Track what changed and why
     * 4. Return scheduled work orders with detailed change information
     *
     * @param workOrders - Work orders to schedule (should be pre-sorted)
     * @returns ScheduleResult with updated work orders and change details
     * @throws {Error} If work orders don't belong to this work center or have circular dependencies
     */
    public schedule(workOrders: WorkOrder[]): ScheduleResult {
        // Validate all work orders belong to this work center
        this.validateWorkOrders(workOrders);

        // Create a map for quick lookup by ID
        const workOrderMap = new Map<string, WorkOrder>();
        workOrders.forEach((wo, index) => {
            // Use index as a simple ID if docId doesn't exist
            const id = `wo-${index}`;
            workOrderMap.set(id, wo);
        });

        // Track scheduled work orders
        const scheduledStates = new Map<string, WorkOrderScheduleState>();
        const changes: ScheduleChange[] = [];

        // Separate maintenance orders from regular orders
        const maintenanceOrders = workOrders.filter(wo => wo.isMaintenance);
        const regularOrders = workOrders.filter(wo => !wo.isMaintenance);

        // Maintenance orders keep their original schedule (cannot be moved)
        maintenanceOrders.forEach((wo) => {
            scheduledStates.set(wo.workOrderNumber, {
                workOrder: wo,
                scheduledStartDate: wo.startDate,
                scheduledEndDate: wo.endDate,
                isScheduled: true
            });

            // Track as "no change" for maintenance orders
            changes.push({
                workOrderNumber: wo.workOrderNumber,
                originalStartDate: wo.startDate,
                originalEndDate: wo.endDate,
                newStartDate: wo.startDate,
                newEndDate: wo.endDate,
                delayMinutes: 0,
                reason: { type: 'no_change' },
                explanation: 'Maintenance work order - cannot be rescheduled (fixed schedule)'
            });
        });

        // Schedule regular work orders
        regularOrders.forEach((wo, index) => {
            const scheduleState = this.scheduleWorkOrder(wo, scheduledStates, workOrders);
            scheduledStates.set(wo.workOrderNumber, scheduleState);

            // Track the change
            const change = this.createScheduleChange(wo, scheduleState, scheduledStates, workOrders);
            changes.push(change);
        });

        // Build result
        const scheduledWorkOrders = workOrders.map((wo, index) => {
            const state = scheduledStates.get(wo.workOrderNumber);
            if (!state) {
                throw new Error(`Internal error: Work order ${wo.workOrderNumber} was not scheduled`);
            }

            return {
                ...wo,
                startDate: state.scheduledStartDate,
                endDate: state.scheduledEndDate
            };
        });

        // Calculate summary statistics
        const changedCount = changes.filter(c => c.delayMinutes > 0).length;
        const totalDelay = changes.reduce((sum, c) => sum + c.delayMinutes, 0);

        return {
            scheduledWorkOrders,
            changes,
            summary: {
                totalWorkOrders: workOrders.length,
                changedWorkOrders: changedCount,
                unchangedWorkOrders: workOrders.length - changedCount,
                maintenanceWorkOrders: maintenanceOrders.length,
                totalDelayMinutes: totalDelay
            }
        };
    }

    /**
     * Validates that all work orders belong to this work center.
     *
     * @param workOrders - Work orders to validate
     * @throws {Error} If any work order doesn't belong to this work center
     */
    private validateWorkOrders(workOrders: WorkOrder[]): void {
        const invalidWorkOrders = workOrders.filter(
            wo => wo.workCenterId !== this.workCenter.name // Assuming workCenterId matches name
        );

        if (invalidWorkOrders.length > 0) {
            const invalidNumbers = invalidWorkOrders.map(wo => wo.workOrderNumber).join(', ');
            throw new Error(
                `Work orders do not belong to work center "${this.workCenter.name}": ${invalidNumbers}`
            );
        }
    }

    /**
     * Schedules a single work order, finding the earliest valid start time.
     *
     * Considers:
     * - Dependency constraints (all parent work orders must complete first)
     * - Work center conflicts (no overlap with already scheduled work)
     * - Shift schedules and maintenance windows
     *
     * @param workOrder - The work order to schedule
     * @param scheduledStates - Map of already scheduled work orders
     * @param allWorkOrders - All work orders being scheduled
     * @returns The scheduled state for this work order
     */
    private scheduleWorkOrder(
        workOrder: WorkOrder,
        scheduledStates: Map<string, WorkOrderScheduleState>,
        allWorkOrders: WorkOrder[]
    ): WorkOrderScheduleState {
        // Find the earliest time this work order can start
        let earliestStart = workOrder.startDate;

        // Check dependency constraints
        if (workOrder.dependsOnWorkOrderIds.length > 0) {
            const dependencyEndTime = this.getLatestDependencyEndTime(
                workOrder,
                scheduledStates,
                allWorkOrders
            );
            if (dependencyEndTime && dependencyEndTime > earliestStart) {
                earliestStart = dependencyEndTime;
            }
        }

        // Check work center conflicts
        const conflictEndTime = this.getEarliestNonConflictingTime(
            earliestStart,
            workOrder.durationMinutes,
            scheduledStates
        );
        if (conflictEndTime > earliestStart) {
            earliestStart = conflictEndTime;
        }

        // Find next valid start time (respecting shifts and maintenance)
        const validStartTime = this.shiftCalculator.getNextValidStartTime(earliestStart);

        // Calculate end date
        const validEndTime = this.shiftCalculator.calculateEndDate(
            validStartTime,
            workOrder.durationMinutes
        );

        return {
            workOrder,
            scheduledStartDate: validStartTime,
            scheduledEndDate: validEndTime,
            isScheduled: true
        };
    }

    /**
     * Gets the latest end time of all dependency work orders.
     *
     * All parent work orders must complete before this work order can start.
     *
     * @param workOrder - The work order with dependencies
     * @param scheduledStates - Map of already scheduled work orders
     * @param allWorkOrders - All work orders being scheduled
     * @returns The latest end time of dependencies, or null if no dependencies
     */
    private getLatestDependencyEndTime(
        workOrder: WorkOrder,
        scheduledStates: Map<string, WorkOrderScheduleState>,
        allWorkOrders: WorkOrder[]
    ): DateTime | null {
        let latestDependencyEndTime: DateTime | null = null;

        for (const depId of workOrder.dependsOnWorkOrderIds) {
            // Find the dependency work order
            const depWorkOrder = allWorkOrders.find(wo => wo.workOrderNumber === depId);

            if (!depWorkOrder) {
                throw new Error(
                    `Dependency not found: Work order ${workOrder.workOrderNumber} ` +
                    `depends on ${depId} which is not in the work order list`
                );
            }

            const depState = scheduledStates.get(depWorkOrder.workOrderNumber);
            if (!depState) {
                throw new Error(
                    `Dependency not scheduled: Work order ${workOrder.workOrderNumber} ` +
                    `depends on ${depId} which has not been scheduled yet. ` +
                    `Ensure work orders are topologically sorted.`
                );
            }

            if (!latestDependencyEndTime || depState.scheduledEndDate > latestDependencyEndTime) {
                latestDependencyEndTime = depState.scheduledEndDate;
            }
        }

        return latestDependencyEndTime;
    }

    /**
     * Finds the earliest time when this work order can start without conflicting
     * with already scheduled work orders on the same work center.
     *
     * @param proposedStart - The proposed start time
     * @param durationMinutes - Duration of the work order
     * @param scheduledStates - Map of already scheduled work orders
     * @returns The earliest non-conflicting start time
     */
    private getEarliestNonConflictingTime(
        proposedStart: DateTime,
        durationMinutes: number,
        scheduledStates: Map<string, WorkOrderScheduleState>
    ): DateTime {
        let currentStart = proposedStart;
        let hasConflict = true;

        // Keep checking until we find a non-conflicting time slot
        while (hasConflict) {
            // Calculate proposed end time for this slot
             
            const proposedEnd = this.shiftCalculator.calculateEndDate(
                currentStart,
                durationMinutes
            );

            // Check for conflicts with all scheduled work orders
            hasConflict = false;
            for (const [_, state] of scheduledStates) {
                if (this.hasTimeOverlap(currentStart, proposedEnd, state.scheduledStartDate, state.scheduledEndDate)) {
                    // Conflict found - try starting after this work order ends
                    hasConflict = true;
                    currentStart = state.scheduledEndDate;
                    break;
                }
            }
        }

        return currentStart;
    }

    /**
     * Checks if two time ranges overlap.
     *
     * Ranges overlap if they share any time in common (touching boundaries don't count).
     *
     * @param start1 - Start of first range
     * @param end1 - End of first range
     * @param start2 - Start of second range
     * @param end2 - End of second range
     * @returns true if ranges overlap, false otherwise
     */
    private hasTimeOverlap(
        start1: DateTime,
        end1: DateTime,
        start2: DateTime,
        end2: DateTime
    ): boolean {
        // Overlap exists if one range starts before the other ends
        // and ends after the other starts
        return start1 < end2 && end1 > start2;
    }

    /**
     * Creates a detailed schedule change record for a work order.
     *
     * Determines why the work order's schedule changed and generates a human-readable explanation.
     *
     * @param originalWorkOrder - The original work order
     * @param scheduleState - The new scheduled state
     * @param scheduledStates - Map of all scheduled work orders
     * @param allWorkOrders - All work orders being scheduled
     * @returns A detailed schedule change record
     */
    private createScheduleChange(
        originalWorkOrder: WorkOrder,
        scheduleState: WorkOrderScheduleState,
        scheduledStates: Map<string, WorkOrderScheduleState>,
        allWorkOrders: WorkOrder[]
    ): ScheduleChange {
        const delayMinutes = scheduleState.scheduledStartDate.diff(
            originalWorkOrder.startDate,
            'minutes'
        ).minutes;

        // Determine the reason for the change
        let reason: ChangeReason;
        let explanation: string;

        if (delayMinutes === 0) {
            // No change
            reason = { type: 'no_change' };
            explanation = 'No schedule change required';
        } else {
            // Analyze why it changed
            reason = this.determineChangeReason(
                originalWorkOrder,
                scheduledStates,
                allWorkOrders
            );
            explanation = this.generateExplanation(reason, delayMinutes);
        }

        return {
            workOrderNumber: originalWorkOrder.workOrderNumber,
            originalStartDate: originalWorkOrder.startDate,
            originalEndDate: originalWorkOrder.endDate,
            newStartDate: scheduleState.scheduledStartDate,
            newEndDate: scheduleState.scheduledEndDate,
            delayMinutes,
            reason,
            explanation
        };
    }

    /**
     * Determines the primary reason why a work order's schedule changed.
     *
     * Priority order:
     * 1. Dependency constraints
     * 2. Work center conflicts
     * 3. Maintenance window conflicts
     *
     * @param workOrder - The work order
     * @param scheduledStates - Map of all scheduled work orders
     * @param allWorkOrders - All work orders being scheduled
     * @returns The primary reason for the schedule change
     */
    private determineChangeReason(
        workOrder: WorkOrder,
        scheduledStates: Map<string, WorkOrderScheduleState>,
        allWorkOrders: WorkOrder[]
    ): ChangeReason {
        // Check dependency constraint first (highest priority)
        if (workOrder.dependsOnWorkOrderIds.length > 0) {
            const latestDepEndTime = this.getLatestDependencyEndTime(
                workOrder,
                scheduledStates,
                allWorkOrders
            );
            if (latestDepEndTime && latestDepEndTime > workOrder.startDate) {
                // Find which dependency caused the delay
                for (const depId of workOrder.dependsOnWorkOrderIds) {
                    const depIndex = allWorkOrders.findIndex(wo =>
                        wo.workOrderNumber === depId || allWorkOrders.indexOf(wo).toString() === depId
                    );
                    const depState = scheduledStates.get(`wo-${depIndex}`);
                    if (depState && depState.scheduledEndDate === latestDepEndTime) {
                        return {
                            type: 'dependency',
                            dependsOnWorkOrderId: `wo-${depIndex}`,
                            dependsOnWorkOrderNumber: depState.workOrder.workOrderNumber
                        };
                    }
                }
            }
        }

        // Check for work center conflicts
        for (const [id, state] of scheduledStates) {
            if (id !== `wo-${allWorkOrders.indexOf(workOrder)}`) {
                if (this.hasTimeOverlap(
                    workOrder.startDate,
                    workOrder.endDate,
                    state.scheduledStartDate,
                    state.scheduledEndDate
                )) {
                    return {
                        type: 'work_center_conflict',
                        conflictingWorkOrderId: id,
                        conflictingWorkOrderNumber: state.workOrder.workOrderNumber
                    };
                }
            }
        }

        // Check for maintenance window conflicts
        for (const window of this.workCenter.maintenanceWindows) {
            if (this.hasTimeOverlap(
                workOrder.startDate,
                workOrder.endDate,
                window.startDate,
                window.endDate
            )) {
                return {
                    type: 'maintenance',
                    maintenanceWindowStart: window.startDate,
                    maintenanceWindowEnd: window.endDate
                };
            }
        }

        // Fallback (shouldn't reach here if delay > 0)
        return { type: 'no_change' };
    }

    /**
     * Generates a human-readable explanation for why a schedule changed.
     *
     * @param reason - The reason for the change
     * @param delayMinutes - How many minutes the work order was delayed
     * @returns A human-readable explanation
     */
    private generateExplanation(reason: ChangeReason, delayMinutes: number): string {
        const hours = Math.floor(delayMinutes / 60);
        const minutes = delayMinutes % 60;
        const delayStr = hours > 0
            ? `${hours}h ${minutes}m`
            : `${minutes}m`;

        switch (reason.type) {
            case 'dependency':
                return `Delayed by ${delayStr} - Must wait for work order ${reason.dependsOnWorkOrderNumber} to complete`;

            case 'maintenance':
                const maintenanceStart = reason.maintenanceWindowStart.toLocaleString(DateTime.DATETIME_SHORT);
                const maintenanceEnd = reason.maintenanceWindowEnd.toLocaleString(DateTime.DATETIME_SHORT);
                return `Delayed by ${delayStr} - Work paused for maintenance window (${maintenanceStart} to ${maintenanceEnd})`;

            case 'work_center_conflict':
                return `Delayed by ${delayStr} - Work center busy with work order ${reason.conflictingWorkOrderNumber}`;

            case 'no_change':
                return 'No schedule change required';

            default:
                return `Delayed by ${delayStr}`;
        }
    }
}
