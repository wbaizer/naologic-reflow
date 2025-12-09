import { DateTime } from 'luxon';
import type { WorkCenter, Shift } from '../types/index.ts';

/**
 * PROMPT USED TO START FILE:
For this file please build the ShiftCalculator class:

Requirements:
1. Constructor takes a WorkCenter document
2. Method: isWorkingTime(dateTime: DateTime): boolean
   - Returns true if dateTime is within ANY shift period for that day of week
   - Returns false if dateTime falls within ANY maintenance window
   - Use Luxon DateTime for all date operations

3. Method: calculateEndDate(startDate: string, durationMinutes: number): DateTime
   - Parse startDate as ISO string using Luxon
   - Initialize currentTime = startDate, remainingMinutes = durationMinutes
   - While remainingMinutes > 0:
     a. If isWorkingTime(currentTime), decrement remainingMinutes
     b. Advance currentTime by 1 minute
     c. If we've checked 10,000 minutes without completion, throw error (infinite loop protection)
   - Return final currentTime

4. Method: getNextValidStartTime(afterDate: string): DateTime
   - Find the earliest time >= afterDate that is within a shift and not in maintenance
   - Check each hour starting from afterDate
   - Return first valid working time found
   - Throw error if no valid time found within 30 days

Edge cases to handle:
- Shifts that span midnight (e.g., 22:00-06:00) - treat as next day
- Maintenance windows that span multiple days
- Work that spans weekends (non-working days)
- Daylight saving time transitions (Luxon handles this)

Use Luxon's DateTime.plus() and .set() methods for time arithmetic.
Add detailed comments explaining the shift boundary logic.
 */

/**
 * ShiftCalculator handles work center availability calculations.
 *
 * Determines when a work center is available for production by:
 * - Checking shift schedules (recurring weekly patterns)
 * - Respecting maintenance windows (specific blocked time periods)
 * - Handling edge cases like midnight-spanning shifts and DST transitions
 *
 * Key edge cases handled:
 * - Shifts spanning midnight (e.g., 22:00-06:00)
 * - Multiple shifts per day
 * - Multi-day maintenance windows
 * - Weekend/non-working days
 * - Daylight saving time transitions (Luxon handles automatically)
 */
export class ShiftCalculator {
    private readonly workCenter: WorkCenter;

    /**
     * Creates a new ShiftCalculator for the given work center.
     *
     * @param workCenter - The work center containing shifts and maintenance windows
     * @throws {Error} If work center has no shifts defined
     */
    constructor(workCenter: WorkCenter) {
        // Validate that work center has at least one shift
        if (!workCenter.shifts || workCenter.shifts.length === 0) {
            throw new Error(
                `WorkCenter "${workCenter.name}" must have at least one shift defined. ` +
                `At least one shift is required for time calculations.`
            );
        }

        this.workCenter = workCenter;
    }

    /**
     * Checks if the given date/time is valid working time.
     *
     * Returns true only if:
     * 1. The time falls within a shift for that day of week, AND
     * 2. The time does NOT fall within any maintenance window
     * UNLESS the object is a maintenance order, in which case the time must fall within the maintenance window.
     *
     * @param dateTime - The Luxon DateTime to check
     * @returns true if this is valid working time, false otherwise
     */
    public isWorkingTime(dateTime: DateTime): boolean {
        return !this.isInMaintenanceWindow(dateTime) && this.isInShift(dateTime);
    }

    /**
     * Calculates when a work order will complete given a start date and duration.
     *
     * Only counts time during valid working hours (within shifts, outside maintenance).
     * Work pauses outside shift hours and resumes in the next shift.
     *
     * Example: 120 min task starting Mon 4PM, shift ends 5PM (Mon-Fri 8AM-5PM)
     * Works 60 min Mon (4PM-5PM) - Pauses - Resumes Tue 8AM - Completes 9AM
     *
     * IMPORTANT: Maintenance orders cannot be rescheduled and will throw an error.
     *
     * @param startDate - DateTime for when work begins
     * @param durationMinutes - Total working minutes required (not elapsed time)
     * @returns The DateTime when the work will complete
     * @throws {Error} If startDate is invalid, duration is negative, or no valid working time exists
     */
    public calculateEndDate(startDate: DateTime, durationMinutes: number): DateTime {
        // Parse and validate input
        let currentTime = startDate;
        // Validate duration
        if (durationMinutes < 0) {
            throw new Error('Duration must be non-negative');
        }

        // Handle zero duration edge case
        if (durationMinutes === 0) {
            return currentTime;
        }

        let remainingMinutes = durationMinutes;
        let iterationCount = 0;
        const MAX_ITERATIONS = 10000;

        // Iterate minute by minute, counting only working minutes
        while (remainingMinutes > 0) {
            // Infinite loop protection
            if (iterationCount >= MAX_ITERATIONS) {
                throw new Error(
                    `Infinite loop protection: Checked ${MAX_ITERATIONS} minutes without completing ` +
                    `${durationMinutes}-minute task starting at ${startDate}. ` +
                    `This may indicate the work center has no valid working time ` +
                    `(no shifts defined or extended maintenance window).`
                );
            }

            // Count this minute if it's working time
            if (this.isWorkingTime(currentTime)) {
                remainingMinutes--;
            }

            // Advance to next minute
            currentTime = currentTime.plus({ minutes: 1 });
            iterationCount++;
        }

        return currentTime;
    }

    /**
     * Finds the next valid working time at or after the given date.
     *
     * Useful for scheduling work orders to start at the earliest available time.
     * Checks hour-by-hour for efficiency (minute-level precision not needed for start times).
     *
     * IMPORTANT: Maintenance orders cannot be rescheduled and will throw an error.
     *
     * @param afterDate - DateTime to search from
     * @returns The next DateTime that is valid working time
     * @throws {Error} If afterDate is invalid, or no working time found within 30 days
     */
    public getNextValidStartTime(afterDate: DateTime): DateTime {
        // Parse and validate input
        let currentTime = afterDate;

        const maxSearchTime = currentTime.plus({ days: 30 });

        // Check hour by hour for next 30 days
        // Using hour-level precision for efficiency - sufficient for start time scheduling
        while (currentTime < maxSearchTime) {
            if (this.isWorkingTime(currentTime)) {
                return currentTime;
            }
            currentTime = currentTime.plus({ hours: 1 });
        }

        // No valid working time found
        throw new Error(
            `No valid working time found within 30 days after ${afterDate}. ` +
            `This may indicate the work center has no active shifts or is in extended maintenance.`
        );
    }

    /**
     * Checks if the given time falls within any maintenance window.
     *
     * @param dateTime - The time to check
     * @returns true if time is in maintenance, false otherwise
     */
    private isInMaintenanceWindow(dateTime: DateTime): boolean {
        return this.workCenter.maintenanceWindows.some(window => {
            // Use inclusive comparison: maintenance blocks the entire window including boundaries
            return dateTime >= window.startDate && dateTime <= window.endDate;
        });
    }

    /**
     * Checks if the given time falls within any shift.
     *
     * Also handles midnight-spanning shifts by checking both:
     * 1. Shifts for the current day
     * 2. Shifts from the previous day that might extend into current day
     *
     * @param dateTime - The time to check
     * @returns true if time is within a shift, false otherwise
     */
    private isInShift(dateTime: DateTime): boolean {
        // Convert Luxon weekday (1=Monday...7=Sunday) to schema weekday (0=Sunday...6=Saturday)
        // Luxon: 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 7=Sun
        // Schema: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
        const currentDayOfWeek = dateTime.weekday % 7;

        // Check all shifts for current day
        const todayShifts = this.getShiftsForDay(currentDayOfWeek);
        for (const shift of todayShifts) {
            if (this.isTimeInShift(dateTime, shift)) {
                return true;
            }
        }

        // Check shifts from previous day that might span midnight into current day
        // Example: Monday 22:00-06:00 shift extends into Tuesday 00:00-05:59
        const previousDayOfWeek = (currentDayOfWeek + 6) % 7; // Go back one day (with wraparound)
        const yesterdayShifts = this.getShiftsForDay(previousDayOfWeek);
        for (const shift of yesterdayShifts) {
            // Only check midnight-spanning shifts from previous day
            if (this.doesShiftSpanMidnight(shift)) {
                if (this.isTimeInShift(dateTime, shift)) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Gets all shifts defined for a specific day of the week.
     *
     * @param dayOfWeek - Day of week (0=Sunday...6=Saturday)
     * @returns Array of shifts for that day (may be empty)
     */
    private getShiftsForDay(dayOfWeek: number): Shift[] {
        return this.workCenter.shifts.filter(shift => shift.dayOfWeek === dayOfWeek);
    }

    /**
     * Determines if a shift spans midnight.
     *
     * A shift spans midnight if its end hour is less than or equal to its start hour.
     * Examples:
     * - 22:00-06:00: spans midnight (22 > 6)
     * - 08:00-17:00: normal shift (8 < 17)
     * - 00:00-00:00: 24-hour shift (edge case)
     *
     * @param shift - The shift to check
     * @returns true if shift spans midnight, false otherwise
     */
    private doesShiftSpanMidnight(shift: Shift): boolean {
        return shift.endHour <= shift.startHour;
    }

    /**
     * Checks if a specific time falls within a specific shift.
     *
     * Handles two cases:
     * 1. Normal shifts (e.g., 08:00-17:00): Simple range check
     * 2. Midnight-spanning shifts (e.g., 22:00-06:00): Split across two days
     *
     * For midnight-spanning shifts:
     * - If dateTime's day matches shift's day: Check if time >= startHour (the "before midnight" part)
     * - If dateTime's day is next day: Check if time < endHour (the "after midnight" part)
     *
     * Example: Monday 22:00-06:00 shift
     * - Monday 23:00 - Matches shift day - Check if 23:00 >= 22:00 - true
     * - Tuesday 02:00 - Next day - Check if 02:00 < 06:00 - true
     * - Tuesday 07:00 - Next day - Check if 07:00 < 06:00 - false
     *
     * Note: We use `<` (not `<=`) for endHour because shifts end at the start of that hour.
     * Example: 9:00-17:00 means work until 16:59:59, not including 17:00:00.
     *
     * @param dateTime - The time to check
     * @param shift - The shift to check against
     * @returns true if time is within this shift, false otherwise
     */
    private isTimeInShift(dateTime: DateTime, shift: Shift): boolean {
        const hour = dateTime.hour;
        const minute = dateTime.minute;
        const timeInMinutes = hour * 60 + minute;
        const shiftStartMinutes = shift.startHour * 60;
        const shiftEndMinutes = shift.endHour * 60;

        if (this.doesShiftSpanMidnight(shift)) {
            // Midnight-spanning shift: Need to determine which part we're checking
            const currentDayOfWeek = dateTime.weekday % 7;

            if (currentDayOfWeek === shift.dayOfWeek) {
                // On the shift's defined day: Check the "before midnight" part
                // Example: Monday 22:00-06:00, checking Monday 23:00
                // Is 23:00 >= 22:00? Yes - In shift
                return timeInMinutes >= shiftStartMinutes;
            } else {
                // On the day after: Check the "after midnight" part
                // Example: Monday 22:00-06:00, checking Tuesday 02:00
                // Is 02:00 < 06:00? Yes - In shift
                // Note: This only gets called for previous day's shifts from isInShift()
                return timeInMinutes < shiftEndMinutes;
            }
        } else {
            // Normal shift: Simple range check
            // Use < for end (not <=) because end hour is exclusive
            // Example: 9:00-17:00 means 09:00:00 to 16:59:59
            return timeInMinutes >= shiftStartMinutes && timeInMinutes < shiftEndMinutes;
        }
    }
}
