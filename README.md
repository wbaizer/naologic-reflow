# Naologic Reflow - Production Schedule Optimization System

A sophisticated production scheduling system that automatically reschedules manufacturing work orders when disruptions occur, respecting shift schedules, maintenance windows, and work order dependencies.

## Overview

The Naologic Reflow system solves a critical manufacturing problem: when a work order is delayed or a conflict occurs, how do you automatically recalculate the entire production schedule while respecting:

- **Shift Schedules** - Work can only happen during defined shifts (including split shifts, midnight-spanning shifts, and weekends)
- **Maintenance Windows** - Blocked time periods when production cannot occur
- **Work Order Dependencies** - Some work orders must wait for others to complete first
- **Work Center Conflicts** - Only one work order can run on a work center at a time
- **Dependency Cascades** - Delays propagate through dependent work orders

Built with **Bun**, **TypeScript**, **Luxon** (DateTime library), and **Zod** (schema validation).

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) v1.0 or higher

### Installation

```bash
# Clone the repository
git clone https://github.com/wbaizer/naologic-reflow.git
cd naologic-reflow

# Install dependencies
bun install
```

### Running the Reflow System

```bash
# Run reflow on a JSONL data file
bun run reflow <path-to-jsonl-file>

# Example with test scenarios
bun run reflow test-scenarios/scenario-1-delay-cascade.jsonl
```

### Example Output

```
=== REFLOW SUMMARY ===

Work Center: Assembly Line A
  Execution Order: WO-CASCADE-001, WO-CASCADE-005-DELAY, WO-CASCADE-002, WO-CASCADE-003, WO-CASCADE-004

  Changed Work Orders:
    ✓ WO-CASCADE-001: 2025-01-13T08:00 → 2025-01-13T13:00 (+300 min)
      Reason: Delayed due to work center conflict with WO-CASCADE-005-DELAY

    ✓ WO-CASCADE-002: 2025-01-13T11:00 → 2025-01-13T16:00 (+300 min)
      Reason: Delayed due to dependency on WO-CASCADE-001

  Duration Metrics:
    Old Duration: 660 minutes (11 hours)
    New Duration: 960 minutes (16 hours)
    Total Delay: 300 minutes (5 hours)
    Changed Work Orders: 4 of 5 (80%)
```

## Project Structure

```
naologic-reflow/
├── src/
│   ├── reflow/
│   │   ├── reflow.service.ts       # Main orchestration service
│   │   └── shift-calculator.ts     # Shift schedule calculations
│   ├── types/
│   │   ├── common.schema.ts        # Base Zod schemas
│   │   ├── workCenter.schema.ts    # Work center type definitions
│   │   ├── workOrder.schema.ts     # Work order type definitions
│   │   ├── manufacturingOrder.schema.ts  # Manufacturing order types
│   │   └── index.ts                # Type exports
│   └── utils/
│       ├── parse.ts                # JSONL parser with Zod validation
│       ├── shift-calendar.ts       # Schedule management and conflict detection
│       ├── topological-sort.ts     # Kahn's algorithm for dependency ordering
│       ├── grouping.ts             # Group work orders by work center
│       └── print.ts                # Console output formatting
├── test-scenarios/
│   ├── README.md                   # Test scenario documentation
│   ├── scenario-1-delay-cascade.jsonl
│   ├── scenario-2-maintenance-conflict.jsonl
│   ├── scenario-3-circular-dependency.jsonl
│   ├── scenario-4-shift-boundary.jsonl
│   ├── scenario-5-complex-dependencies.jsonl
│   └── scenario-6-weekend-spanning.jsonl
├── index.ts                        # CLI entry point
├── package.json                    # Project configuration
├── tsconfig.json                   # TypeScript configuration
└── README.md                       # This file
```

## Architecture Overview

### Data Flow

```
1. JSONL File
      ↓
2. Parser (parse.ts)
   - Parses JSONL format
   - Converts ISO strings to Luxon DateTime
   - Validates with Zod schemas
      ↓
3. Grouping (grouping.ts)
   - Groups work orders by work center
      ↓
4. Topological Sort (topological-sort.ts)
   - Orders work orders by dependencies using Kahn's algorithm
   - Detects circular dependencies
      ↓
5. Shift Calendar (shift-calendar.ts)
   - Schedules each work order in dependency order
   - Detects conflicts (work center overlaps, maintenance windows)
   - Reschedules conflicting work orders
   - Tracks all changes and reasons
      ↓
6. Reflow Service (reflow.service.ts)
   - Orchestrates entire process
   - Calculates duration metrics
      ↓
7. Print (print.ts)
   - Formats and displays results
```

### Core Components

#### 1. Parser ([src/utils/parse.ts](src/utils/parse.ts))
**Purpose:** Parse JSONL files and validate data

**Key Features:**
- Parses newline-delimited JSON (JSONL format)
- Recursively converts ISO date strings to Luxon DateTime objects
- Validates documents against Zod schemas
- Separates work centers, work orders, and manufacturing orders

**Key Functions:**
- `parseDataFile(filePath: string)` - Parse file from disk
- `parseDataString(content: string)` - Parse from string
- `preprocessDocument(doc: any)` - Convert ISO strings to DateTime

#### 2. ShiftCalculator ([src/reflow/shift-calculator.ts](src/reflow/shift-calculator.ts))
**Purpose:** Determine working time availability for a work center

**Key Features:**
- Checks if a given time falls within working hours
- Handles midnight-spanning shifts (e.g., 22:00-06:00)
- Respects maintenance windows (blocked time)
- Calculates when work will complete given a duration
- Finds next available working time

**Key Methods:**
- `isWorkingTime(dateTime: DateTime): boolean` - Is this time valid for work?
- `calculateEndDate(startDate: string, durationMinutes: number): DateTime` - When will work complete?
- `getNextValidStartTime(afterDate: string): DateTime` - Find next working time

**Edge Cases Handled:**
- Midnight-spanning shifts (Monday 22:00 shift spans to Tuesday 06:00)
- Multi-day maintenance windows
- Weekend/non-working days
- Daylight Saving Time transitions
- Split shifts with lunch breaks

#### 3. ShiftCalendar ([src/utils/shift-calendar.ts](src/utils/shift-calendar.ts))
**Purpose:** Schedule work orders and detect conflicts

**Key Features:**
- Schedules work orders respecting dependencies
- Detects work center conflicts (overlapping work orders)
- Detects maintenance window conflicts
- Automatically reschedules conflicting orders
- Tracks old vs new schedule for every work order
- Provides detailed change reasons

**Key Methods:**
- `schedule(workOrders: WorkOrder[]): ScheduleResult` - Schedule all work orders
- `scheduleWorkOrder(wo: WorkOrder, scheduledStates: Map)` - Schedule single order
- `getEarliestNonConflictingTime(...)` - Find earliest valid start time

**Change Reasons Tracked:**
- "Delayed due to work center conflict with {workOrderNumber}"
- "Delayed due to maintenance window"
- "Delayed due to dependency on {workOrderNumber}"
- "No change - scheduled at original time"

#### 4. Topological Sort ([src/utils/topological-sort.ts](src/utils/topological-sort.ts))
**Purpose:** Order work orders by dependencies using Kahn's algorithm

**Algorithm:**
1. Calculate in-degree for each node (number of dependencies)
2. Start with nodes that have in-degree 0 (no dependencies)
3. Process each node, decrement in-degree of dependents
4. Add newly zero-degree nodes to queue
5. If graph isn't fully processed → circular dependency detected

**Error Detection:**
- Throws error if circular dependency found
- Lists all work orders in the cycle

#### 5. Reflow Service ([src/reflow/reflow.service.ts](src/reflow/reflow.service.ts))
**Purpose:** Main orchestration - ties all components together

**Process:**
1. Parse JSONL file
2. Group work orders by work center
3. For each work center:
   - Topologically sort work orders
   - Schedule using ShiftCalendar
   - Collect results
4. Calculate overall metrics
5. Print summary

#### 6. Type System ([src/types/](src/types/))
**Purpose:** Zod schemas and TypeScript types

**Key Schemas:**
- `WorkCenterSchema` - Work center with shifts and maintenance windows
- `WorkOrderSchema` - Work order with dependencies
- `ManufacturingOrderSchema` - Manufacturing order with due date
- `DateTimeSchema` - Custom Zod schema for Luxon DateTime validation

**Document Pattern:**
All documents follow a common pattern:
```typescript
{
  docId: string,
  docType: 'workOrder' | 'workCenter' | 'manufacturingOrder',
  data: { ... }
}
```

## JSONL File Format

Input files use JSONL (JSON Lines) format - one JSON object per line.

### Example JSONL File

```jsonl
{"docId":"wc-001","docType":"workCenter","data":{"name":"Assembly Line A","shifts":[{"dayOfWeek":1,"startHour":8,"endHour":17}],"maintenanceWindows":[]}}
{"docId":"mo-001","docType":"manufacturingOrder","data":{"manufacturingOrderNumber":"MO-100","itemId":"PART-A","quantity":1000,"dueDate":"2025-01-20T17:00:00"}}
{"docId":"wo-001","docType":"workOrder","data":{"workOrderNumber":"WO-001","manufacturingOrderId":"MO-100","workCenterId":"Assembly Line A","startDate":"2025-01-13T08:00:00","endDate":"2025-01-13T11:00:00","durationMinutes":180,"isMaintenance":false,"dependsOnWorkOrderIds":[]}}
{"docId":"wo-002","docType":"workOrder","data":{"workOrderNumber":"WO-002","manufacturingOrderId":"MO-100","workCenterId":"Assembly Line A","startDate":"2025-01-13T11:00:00","endDate":"2025-01-13T14:00:00","durationMinutes":180,"isMaintenance":false,"dependsOnWorkOrderIds":["WO-001"]}}
```

### Work Center Format

```json
{
  "docId": "wc-001",
  "docType": "workCenter",
  "data": {
    "name": "Assembly Line A",
    "shifts": [
      {
        "dayOfWeek": 1,     // 0=Sunday, 1=Monday, ..., 6=Saturday
        "startHour": 8,     // 8am
        "endHour": 17       // 5pm
      }
    ],
    "maintenanceWindows": [
      {
        "startDate": "2025-01-14T10:00:00",
        "endDate": "2025-01-14T13:00:00",
        "reason": "Hydraulic maintenance"
      }
    ]
  }
}
```

**Shift Notes:**
- `dayOfWeek`: 0=Sunday, 1=Monday, 2=Tuesday, ..., 6=Saturday
- `startHour`/`endHour`: 24-hour format (0-23)
- Midnight-spanning shifts: `endHour <= startHour` (e.g., startHour=22, endHour=6)
- Multiple shifts per day allowed

### Work Order Format

```json
{
  "docId": "wo-001",
  "docType": "workOrder",
  "data": {
    "workOrderNumber": "WO-001",
    "manufacturingOrderId": "MO-100",
    "workCenterId": "Assembly Line A",
    "startDate": "2025-01-13T08:00:00",
    "endDate": "2025-01-13T11:00:00",
    "durationMinutes": 180,
    "isMaintenance": false,
    "dependsOnWorkOrderIds": ["WO-000"]
  }
}
```

**Work Order Notes:**
- `workCenterId`: Must match a work center's `name` field
- `durationMinutes`: Actual working time (excludes breaks/weekends)
- `isMaintenance`: If true, work order cannot be rescheduled
- `dependsOnWorkOrderIds`: Array of work order numbers this depends on
- Dates in ISO 8601 format with timezone

### Manufacturing Order Format

```json
{
  "docId": "mo-001",
  "docType": "manufacturingOrder",
  "data": {
    "manufacturingOrderNumber": "MO-100",
    "itemId": "PART-A",
    "quantity": 1000,
    "dueDate": "2025-01-20T17:00:00"
  }
}
```

## Test Scenarios

The `test-scenarios/` directory contains 6 comprehensive test cases:

| Scenario | Tests | Expected Result |
|----------|-------|-----------------|
| 1. Delay Cascade | Work center conflict causing chain delays | ✅ Cascade through 4 dependent orders |
| 2. Maintenance Conflict | Double shifts with maintenance windows | ✅ Reschedule around blocked time |
| 3. Circular Dependency | A→B→C→A cycle | ❌ Error thrown (by design) |
| 4. Shift Boundary | Split shifts with lunch break | ✅ Pause during non-working time |
| 5. Complex Dependencies | Diamond pattern (multi-parent) | ✅ Wait for all parents |
| 6. Weekend Spanning | Friday-only shifts | ✅ Pause over weekend, resume Monday |

See [test-scenarios/README.md](test-scenarios/README.md) for detailed scenarios with visual diagrams.

### Running Test Scenarios

```bash
# Run all valid scenarios
for file in test-scenarios/scenario-{1,2,4,5,6}-*.jsonl; do
  echo "Testing: $file"
  bun run reflow "$file"
done

# Test error scenario (should fail)
bun run reflow test-scenarios/scenario-3-circular-dependency.jsonl
```

## Development

### Building

```bash
# TypeScript is compiled on-the-fly by Bun
# No build step needed
```

### Code Style

- **ES Modules**: Uses `.ts` extensions in imports
- **Strict TypeScript**: Strict mode enabled
- **Zod Validation**: Runtime type checking for all external data
- **Luxon DateTime**: Timezone-aware date handling
- **Error Handling**: Descriptive error messages with context

### Adding New Features

#### Adding a New Shift Type

1. Modify `ShiftSchema` in [src/types/workCenter.schema.ts](src/types/workCenter.schema.ts)
2. Update `isTimeInShift()` logic in [src/reflow/shift-calculator.ts](src/reflow/shift-calculator.ts)
3. Add test scenario in `test-scenarios/`

#### Adding a New Conflict Type

1. Add detection logic to `getEarliestNonConflictingTime()` in [src/utils/shift-calendar.ts](src/utils/shift-calendar.ts)
2. Add new change reason string
3. Update `ChangeReason` type if needed
4. Add test scenario

## Key Algorithms

### Kahn's Topological Sort (Dependency Ordering)

**Purpose:** Order work orders so dependencies are scheduled before dependents

**Algorithm:**
```
1. Calculate in-degree for each node (# of dependencies)
2. Queue ← nodes with in-degree 0
3. While Queue not empty:
     node ← dequeue
     result.push(node)
     For each dependent of node:
       decrement dependent's in-degree
       if in-degree == 0: enqueue(dependent)
4. If result.length != total nodes → circular dependency
```

**Complexity:** O(V + E) where V = work orders, E = dependencies

### Conflict Detection (Work Center Scheduling)

**Purpose:** Find earliest time a work order can start without conflicts

**Algorithm:**
```
1. Start with: max(original start time, parent completion times)
2. While true:
     If NOT working time → advance to next working time
     If in maintenance window → advance past maintenance
     If conflicts with other work order → advance past that order
     If no conflicts → return this time
     Advance by 1 minute (safety against infinite loops)
```

**Complexity:** O(n * m) where n = minutes searched, m = conflicts checked per minute

### Working Time Calculation (Shift Boundaries)

**Purpose:** Calculate when work will complete given duration and shifts

**Algorithm:**
```
1. currentTime ← startDate
2. remainingMinutes ← durationMinutes
3. While remainingMinutes > 0:
     If isWorkingTime(currentTime):
       remainingMinutes--
     currentTime += 1 minute
     Safety check: iterations < 10,000
4. Return currentTime
```

**Handles:** Shift gaps, weekends, maintenance windows, midnight-spanning shifts, DST

## Performance Characteristics

- **Small schedules** (<50 work orders): < 100ms
- **Medium schedules** (50-500 work orders): 100ms - 1s
- **Large schedules** (500+ work orders): 1s - 10s

**Bottlenecks:**
- Minute-by-minute iteration in `calculateEndDate()` for long durations
- Conflict checking grows with number of work orders per work center

**Future Optimizations:**
- Jump by shift duration instead of minute-by-minute
- Use interval tree for conflict detection (O(log n) instead of O(n))
- Parallelize work center processing

## Error Handling

### Common Errors

**Circular Dependency**
```
Error: Circular dependency detected in work orders.
The following work orders are part of a dependency cycle:
WO-A, WO-B, WO-C
```

**Solution:** Remove circular dependency from input data

**Invalid Date Format**
```
Error: Invalid work order document: Invalid date at data.startDate
```

**Solution:** Ensure dates are in ISO 8601 format (YYYY-MM-DDTHH:mm:ss)

**Infinite Loop Protection**
```
Error: Infinite loop protection: Checked 10000 minutes without completing 480-minute task.
This may indicate the work center has no valid working time.
```

**Solution:** Check work center has at least one shift defined and maintenance windows don't block all time

## Troubleshooting

### Work orders not being rescheduled

**Check:**
1. Are shifts defined for the work center?
2. Is the work center name spelled exactly the same?
3. Are maintenance windows blocking all available time?
4. Is the work order marked as `isMaintenance: true`? (cannot be rescheduled)

### Unexpected delays

**Check:**
1. Examine dependency graph - delays cascade through dependencies
2. Check for work center conflicts - only one work order per center at a time
3. Review maintenance windows - might be blocking preferred times
4. Check shift boundaries - work might pause overnight or on weekends

### Parser errors

**Check:**
1. JSONL format - one JSON object per line (no commas between lines)
2. Valid JSON - use a JSON validator
3. ISO date format - `YYYY-MM-DDTHH:mm:ss` or with timezone
4. Work center name matches exactly in work orders

## License

[Insert License Here]

## Contributing

[Insert Contributing Guidelines Here]

## Support

For issues or questions, see the [issue tracker](https://github.com/your-org/naologic-reflow/issues).

---

Built with Bun + TypeScript + Luxon + Zod
