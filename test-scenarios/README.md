# Test Scenarios for Reflow System

This directory contains various test scenarios to validate the production schedule reflow system.

## Running Tests

```bash
bun run reflow test-scenarios/scenario-1-delay-cascade.jsonl
```

## Scenario Descriptions

### Scenario 1: Delay Cascade
**File:** `scenario-1-delay-cascade.jsonl`

**Purpose:** Tests how a delayed work order cascades through dependent orders.

**Setup:**
- Work Center: Assembly Line A (single shift, 8am-5pm, Mon-Fri)
- 5 work orders with dependency chain
- WO-CASCADE-005-DELAY starts at 9am (conflicts with WO-CASCADE-001 at 8am)

**Dependency Graph:**
```
WO-CASCADE-001 (8am-11am, 180min)
    ↓
WO-CASCADE-002 (11am-2pm, 180min) [depends on 001]
    ↓
WO-CASCADE-003 (2pm-4pm, 120min) [depends on 002]
    ↓
WO-CASCADE-004 (4pm-7pm, 180min) [depends on 003]

CONFLICT: WO-CASCADE-005-DELAY (9am-1pm, 240min) [independent, overlaps with 001]
```

**Timeline Visualization:**
```
Assembly Line A [Mon-Fri 8am-5pm]
─────────────────────────────────────────────────────
Monday 8am    9am    10am   11am   12pm   1pm    2pm    3pm    4pm    5pm
       │──001──│      │      │      │      │      │      │      │      │
       │       │──005-DELAY──────────│      │      │      │      │      │
       │      CONFLICT!              │      │      │      │      │      │
       │                             │─002──│      │      │      │      │
       │                             │      │      │─003──│      │      │
       │                             │      │      │      │      │─004──│
                                                                  (spans to Tue)
```

**Expected Behavior:**
- WO-CASCADE-005-DELAY should cause WO-CASCADE-001 to be delayed by 4 hours
- WO-CASCADE-002 depends on WO-CASCADE-001, so it delays
- WO-CASCADE-003 depends on WO-CASCADE-002, so it delays
- WO-CASCADE-004 depends on WO-CASCADE-003, cascading the delay further
- Should see multiple "Delayed due to work center conflict" changes

---

### Scenario 2: Maintenance Window Conflicts
**File:** `scenario-2-maintenance-conflict.jsonl`

**Purpose:** Tests work order rescheduling around maintenance windows.

**Setup:**
- Work Center: Production Line B (double shift, 6am-2pm and 2pm-10pm)
- Two maintenance windows:
  - Jan 14, 10am-1pm (Hydraulic maintenance)
  - Jan 15, 3pm-5pm (Calibration)
- Work orders scheduled to conflict with both windows
- 2 maintenance work orders (cannot be rescheduled)

**Dependency Graph:**
```
WO-MAINT-001 (8am-12pm, 240min)
    ↓
WO-MAINT-002 (12pm-4pm, 240min) [depends on 001]

WO-MAINT-003 (2pm-6pm, 240min) [independent]

WO-MAINT-SCHEDULED (10am-1pm, 180min) [MAINTENANCE - FIXED]
WO-MAINT-CALIBRATION (3pm-5pm, 120min) [MAINTENANCE - FIXED]
```

**Timeline Visualization:**
```
Production Line B [Mon-Fri 6am-2pm, 2pm-10pm]
────────────────────────────────────────────────────────────────
Jan 14  6am    8am    10am   12pm   2pm    4pm    6pm    8pm    10pm
Shift 1 ├──────├──────├──────├──────┤
Shift 2                       ├──────├──────├──────├──────├──────┤
        │      │─001──│XXXXX │      │      │      │      │      │
        │      │      │MAINT │─002──│      │      │      │      │
        │      │      │XXXXX │      CONFLICT!      │      │      │

Jan 15  6am    8am    10am   12pm   2pm    4pm    6pm    8pm    10pm
Shift 1 ├──────├──────├──────├──────┤
Shift 2                       ├──────├──────├──────├──────├──────┤
        │      │      │      │      │─003──│XXXXX │      │      │
        │      │      │      │      │      │CALIB │      │      │
        │      │      │      │      │      │XXXXX │      │      │
                                            CONFLICT!

XXXXX = Maintenance Window (blocked time)
```

**Expected Behavior:**
- WO-MAINT-001 (8am-12pm) should conflict with maintenance at 10am-1pm
- WO-MAINT-002 (12pm-4pm) depends on WO-MAINT-001 and also conflicts
- WO-MAINT-003 (2pm-6pm) should conflict with calibration at 3pm-5pm
- Should see "Delayed due to maintenance window" changes
- Maintenance orders WO-MAINT-SCHEDULED and WO-MAINT-CALIBRATION stay fixed

---

### Scenario 3: Circular Dependency (Error Case)
**File:** `scenario-3-circular-dependency.jsonl`

**Purpose:** Tests circular dependency detection in topological sort.

**Setup:**
- Work Center: Test Line C
- 3 work orders forming a circular dependency:
  - WO-CIRC-A depends on WO-CIRC-B
  - WO-CIRC-B depends on WO-CIRC-C
  - WO-CIRC-C depends on WO-CIRC-A (creates cycle)

**Dependency Graph (INVALID):**
```
    ┌──────────────────────┐
    │                      │
    ↓                      │
WO-CIRC-A (8am-10am)      │
    ↓                      │
WO-CIRC-B (10am-12pm)     │
    ↓                      │
WO-CIRC-C (12pm-2pm)      │
    │                      │
    └──────────────────────┘
         CIRCULAR!
```

**Expected Behavior:**
- System should throw error: "Circular dependency detected"
- Error message should list: WO-CIRC-A, WO-CIRC-B, WO-CIRC-C
- ❌ This scenario should FAIL (by design)

---

### Scenario 4: Shift Boundary Crossings
**File:** `scenario-4-shift-boundary.jsonl`

**Purpose:** Tests work orders that span multiple shifts with gaps.

**Setup:**
- Work Center: Packaging Line D (split shifts with lunch break)
  - Morning: 8am-12pm
  - Afternoon: 1pm-5pm (1 hour lunch break)
- Work orders scheduled to cross shift boundaries

**Dependency Graph:**
```
WO-SHIFT-001 (11am-2pm, 180min)
    ↓
WO-SHIFT-002 (2pm-4pm, 120min) [depends on 001]

WO-SHIFT-003 (10am-3pm, 300min) [independent]
```

**Timeline Visualization:**
```
Packaging Line D [Mon-Fri 8am-12pm, 1pm-5pm]
─────────────────────────────────────────────────────
Monday 8am    9am    10am   11am   12pm | 1pm    2pm    3pm    4pm    5pm
Shift  ├──────├──────├──────├──────┤LUNCH├──────├──────├──────├──────┤
       │      │      │      │─001──│XXXXX│─001──│      │      │      │
       │      │      │      │       │XXXXX│      │─002──│      │      │
       │      │      │─003──│───────│XXXXX│──────│─003──│      │      │
                                    PAUSE!        RESUME

XXXXX = Non-working time (lunch break)
```

**Expected Behavior:**
- WO-SHIFT-001 (11am-2pm, 180 min) should pause during 12pm-1pm lunch
- Actual completion should be later due to lunch break
- WO-SHIFT-003 (10am-3pm, 300 min) should also pause for lunch
- Duration calculations should account for non-working time

---

### Scenario 5: Complex Multi-Parent Dependencies
**File:** `scenario-5-complex-dependencies.jsonl`

**Purpose:** Tests work orders with multiple dependencies (convergence).

**Setup:**
- Work Center: Multi-Stage Line E (double shift with daily cleaning)
- Diamond-shaped dependency graph:
  - WO-COMPLEX-BASE-1 and WO-COMPLEX-BASE-2 run in parallel
  - WO-COMPLEX-MID-1 depends on BOTH base orders
  - WO-COMPLEX-MID-2 depends only on BASE-2
  - WO-COMPLEX-FINAL depends on BOTH mid-stage orders
- Maintenance window during afternoon shift

**Dependency Graph (Diamond Pattern):**
```
    BASE-1 (7am-10am, 180min)
      ↓  ╲
      ↓   ╲___________________
      ↓                       ↘
    BASE-2 (7am-9am, 120min)  ↘
      ↓                        ↘
      ↓                      MID-1 (10am-1pm, 180min)
      ↓                         ↓
    MID-2 (9am-11am, 120min)    ↓
      ↓                         ↓
      ↓_____________________ __↓
                            ↘ ↙
                      FINAL (3pm-7pm, 240min)
                             ↓
                        [CONFLICTS with MAINT 4pm-6pm]

MAINT (4pm-6pm, 120min) [MAINTENANCE - FIXED]
```

**Timeline Visualization:**
```
Multi-Stage Line E [Mon-Fri 7am-3pm, 3pm-11pm]
────────────────────────────────────────────────────────────────────
Jan 13  7am    9am    11am   1pm  | 3pm    5pm    7pm    9pm    11pm
Shift 1 ├──────├──────├──────├────┤
Shift 2                            ├──────├──────├──────├──────├────┤
        │BASE1─│──────│      │    │      │      │      │      │    │
        │BASE2─│      │      │    │      │      │      │      │    │
        │      │MID2──│      │    │      │      │      │      │    │
        │      │      │MID1──│    │FINAL─│XXXXX │FINAL │      │    │
                                          │MAINT │
                                          │XXXXX │
                                          CONFLICT!

XXXXX = Maintenance Window (blocked time)
```

**Expected Behavior:**
- WO-COMPLEX-MID-1 must wait for BOTH parent orders to complete (waits for BASE-1)
- WO-COMPLEX-FINAL must wait for the latest of its two parents (waits for MID-1)
- WO-COMPLEX-FINAL (3pm-7pm) should be delayed by maintenance (4pm-6pm)
- Demonstrates fan-out and fan-in dependency patterns

---

### Scenario 6: Weekend Spanning
**File:** `scenario-6-weekend-spanning.jsonl`

**Purpose:** Tests work orders that would span non-working days (weekends).

**Setup:**
- Work Center: Continuous Line F (Friday and Monday shifts only, 8am-5pm)
- WO-WEEKEND-FRI ends at 5pm Friday
- WO-WEEKEND-SPAN starts at 4pm Friday, needs 480 minutes (8 hours)

**Dependency Graph:**
```
WO-WEEKEND-FRI (2pm-5pm, 180min)
    ↓
WO-WEEKEND-SPAN (4pm-midnight, 480min) [depends on FRI]
    └─> SPANS WEEKEND (no work Sat-Sun)
```

**Timeline Visualization:**
```
Continuous Line F [Friday and Monday only, 8am-5pm]
────────────────────────────────────────────────────────────────
Fri Jan 17    8am        12pm        4pm   5pm
Shift         ├───────────├───────────├─────┤
              │           │           │     │
              │           │FRI────────│     │
              │           │           │SPAN─│XXXXXXXXXXXXXXXXXXXXX
                                            (pauses - no weekend shifts)

Sat Jan 18    XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX (no shifts)

Sun Jan 19    XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX (no shifts)

Mon Jan 20    8am        12pm        4pm   5pm
Shift         ├───────────├───────────├─────┤
              │SPAN───────────────────│     │
              (resumes Monday)

XXXXX = Non-working time (weekend)
```

**Expected Behavior:**
- WO-WEEKEND-SPAN cannot complete on Friday (only 1 hour left)
- Should pause over weekend (Sat-Sun have no shifts)
- Should resume Monday morning at 8am
- Actual completion should be Monday afternoon (after 8 hours of work)
- Demonstrates multi-day pause handling

---

### Scenario 7: Complex Multi-Level Dependencies with Variable Shifts
**File:** `scenario-7-complex-dependencies-2.jsonl`

**Purpose:** Tests deeply nested dependency graphs with multiple convergence points, variable shift schedules, and maintenance conflicts.

**Setup:**
- Work Center: Multi-Stage Line E (variable shifts across weekdays, with lunch breaks)
  - Monday: 7am-12pm, 1pm-5pm
  - Tuesday: 8am-12pm, 1pm-7pm
  - Wednesday: 7am-12pm, 1pm-5pm
  - Thursday: 7am-12pm, 1pm-6pm
  - Friday: 7am-12pm, 1pm-11pm (extended evening shift)
- 9 production work orders with multi-level dependencies
- 3 maintenance work orders (fixed schedule)
- Maintenance window: Jan 14, 4pm-6pm

**Dependency Graph (Complex Multi-Level Tree):**
```
Three independent root chains:

Chain 1:                Chain 2:            Chain 3:
WO-05 (120min)          WO-02 (180min)      WO-09 (120min)
  ↓                       ↓                   ↓
WO-04 (120min)            │                 WO-08 (120min)
[dep: WO-05]              │                 [dep: WO-09]
  ↓                       │                   ↓
  ├───────┐               │                 WO-07 (120min)
  ↓       ↓               │                 [dep: WO-08]
WO-06   WO-03─────────────┘
(120min) (180min)
[dep:04,05] [dep:04,05]
            ↓
            └──────┐
                   ↓
               WO-01 (240min)
             [dep: WO-02, WO-03]
         (Final convergence point)

MAINTENANCE (FIXED):
  WO-MAINT-1: Jan 14, 4pm-6pm (120min)
  WO-MAINT-2: Jan 15, 4pm-6pm (120min)
  WO-MAINT-3: Jan 15, 4pm-6pm (120min) [conflicts with MAINT-2]
```

**Detailed Dependency Breakdown:**
```
Level 0 (Roots - 3 independent starting points):
  WO-05 → no dependencies (Chain 1 root)
  WO-02 → no dependencies (Chain 2 root)
  WO-09 → no dependencies (Chain 3 root)

Level 1:
  WO-04 → depends on [WO-05]
  WO-08 → depends on [WO-09]

Level 2:
  WO-06 → depends on [WO-04, WO-05]
  WO-03 → depends on [WO-04, WO-05]
  WO-07 → depends on [WO-08]

Level 3 (Final convergence):
  WO-01 → depends on [WO-02, WO-03]
```

**Work Order Details:**

Chain 1 (WO-05 root):
- WO-05: 120 min, no dependencies (root)
- WO-04: 120 min, waits for WO-05
- WO-06: 120 min, waits for BOTH WO-04 AND WO-05
- WO-03: 180 min, waits for BOTH WO-04 AND WO-05

Chain 2 (WO-02 root):
- WO-02: 180 min, no dependencies (root)

Chain 3 (WO-09 root):
- WO-09: 120 min, no dependencies (root)
- WO-08: 120 min, waits for WO-09
- WO-07: 120 min, waits for WO-08

Final Convergence:
- WO-01: 240 min, waits for BOTH WO-02 AND WO-03 (chains 1 & 2 converge)

**Timeline Visualization:**
```
Multi-Stage Line E [Variable shifts Mon-Fri]
────────────────────────────────────────────────────────────────────
Jan 13 (Mon)  7am    9am    11am | 1pm    3pm    5pm    7pm    9pm
Shift         ├─────├──────┤LUNCH├─────├─────┤
              │WO05─│      │     │     │     │
              │     │WO04──│     │     │     │
              │WO02─├──────│─────│     │     │
              │     │      │     │WO03─├─────│
              │     │      │     │     │     │WO06─┐
              │WO09─│      │     │     │     │     │
              │     │WO08──│     │     │     │     │
                                        (spans to Tue)

Jan 14 (Tue)  8am    10am   12pm | 1pm    3pm    5pm    7pm
Shift         ├─────├──────┤LUNCH├─────├─────├─────├─────┤
              WO06──│      │     │     │     │     │     │
              │     │WO07──│     │     │     │     │     │
              │     │      │     │WO01─├─────│XXXXX│WO01─│
                                              MAINT
                                              XXXXX
                                             CONFLICT!

XXXXX = Maintenance Window (blocked time)
```

**Expected Behavior:**
- **Three independent root chains**: WO-05, WO-02, and WO-09 can all start simultaneously (no dependencies)
- **Multi-level convergence**: WO-01 must wait for WO-02 AND WO-03, where WO-03 itself waits for WO-04 and WO-05
- **Parallel execution**: All three root chains (WO-05, WO-02, WO-09) run in parallel
- **Fan-out then fan-in**: WO-05 → WO-04 → splits into both WO-06 and WO-03
- **Chain isolation**: Chain 3 (WO-09→WO-08→WO-07) is completely independent and never converges with other chains
- **Final convergence point**: Only chains 1 and 2 converge at WO-01 (via WO-03 and WO-02)
- **Variable shift handling**: Different working hours each day (Monday 7am-5pm, Tuesday 8am-7pm, etc.)
- **Lunch break pauses**: Work pauses during 12pm-1pm daily
- **Maintenance conflicts**: WO-01 scheduled for 3pm-7pm conflicts with 4pm-6pm maintenance
- **Multiple maintenance orders**: WO-MAINT-2 and WO-MAINT-3 both scheduled at same time (4pm-6pm on Jan 15)

**Key Test Features:**
1. **Three independent root chains** starting in parallel
2. **Deep dependency nesting** (4 levels: root → level 1 → level 2 → level 3)
3. **Multiple convergence points** (WO-06, WO-03, WO-01)
4. **Isolated chain** (Chain 3 never converges with others)
5. **Variable shift schedules** across weekdays
6. **Lunch break handling** (12pm-1pm gaps)
7. **Maintenance window conflicts**
8. **Overlapping maintenance orders** (same time slot)

---

## Summary of Test Coverage

| Scenario | Tests Feature | Visual Pattern |
|----------|---------------|----------------|
| 1 | Work center conflicts, dependency cascades | Chain: A→B→C→D + conflict |
| 2 | Maintenance window avoidance, double shifts | Dependencies + blocked time windows |
| 3 | Circular dependency detection (error handling) | Cycle: A→B→C→A |
| 4 | Shift gaps (lunch breaks), non-continuous shifts | Work spanning non-continuous shifts |
| 5 | Multiple parent dependencies, complex graphs | Diamond: BASE₁,BASE₂ → MID₁,MID₂ → FINAL |
| 6 | Weekend spanning, multi-day delays | Friday work → weekend pause → Monday resume |
| 7 | Deep nested dependencies, variable shifts | Multi-level tree: 5 levels, multiple convergence points |

## Graph Symbols Legend

```
→  ↓  ↘  ╲     = Dependency relationship (A depends on B)
├──────┤       = Shift time (working hours)
│XXXXX│        = Blocked time (maintenance/lunch/weekend)
CONFLICT!      = Scheduling conflict detected
[FIXED]        = Maintenance order (cannot reschedule)
```

## Expected Metrics

Each scenario should produce:
- ✅ **Total Duration**: Time from earliest start to latest end
- ✅ **Old Duration**: Original schedule duration
- ✅ **Total Delay**: Difference (old - new, positive = optimization)
- ✅ **Changed Work Orders**: Count of rescheduled orders
- ✅ **Execution Order**: Topologically sorted list
- ✅ **Change Explanations**: Why each order was rescheduled

## Quick Test All Scenarios

```bash
# Test valid scenarios (should succeed)
for file in scenario-{1,2,4,5,6,7}-*.jsonl; do
  echo "Testing: $file"
  bun run reflow "test-scenarios/$file"
done

# Test error scenario (should fail with circular dependency)
bun run reflow test-scenarios/scenario-3-circular-dependency.jsonl
```
