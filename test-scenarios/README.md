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

**Expected Behavior:**
- WO-CASCADE-005-DELAY should cause WO-CASCADE-001 to be delayed by 5 hours
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

**Expected Behavior:**
- System should throw error: "Circular dependency detected"
- Error message should list: WO-CIRC-A, WO-CIRC-B, WO-CIRC-C

---

### Scenario 4: Shift Boundary Crossings
**File:** `scenario-4-shift-boundary.jsonl`

**Purpose:** Tests work orders that span multiple shifts with gaps.

**Setup:**
- Work Center: Packaging Line D (split shifts with lunch break)
  - Morning: 8am-12pm
  - Afternoon: 1pm-5pm (1 hour lunch break)
- Work orders scheduled to cross shift boundaries

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

**Expected Behavior:**
- WO-COMPLEX-MID-1 must wait for BOTH parent orders to complete
- WO-COMPLEX-FINAL must wait for the latest of its two parents
- WO-COMPLEX-FINAL (3pm-7pm) should be delayed by maintenance (4pm-6pm)
- Demonstrates fan-out and fan-in dependency patterns

---

### Scenario 6: Weekend Spanning
**File:** `scenario-6-weekend-spanning.jsonl`

**Purpose:** Tests work orders that would span non-working days (weekends).

**Setup:**
- Work Center: Continuous Line F (Friday only shifts, 8am-5pm)
- WO-WEEKEND-FRI ends at 5pm Friday
- WO-WEEKEND-SPAN starts at 4pm Friday, needs 480 minutes (8 hours)

**Expected Behavior:**
- WO-WEEKEND-SPAN cannot complete on Friday (only 1 hour left)
- Should pause over weekend (Sat-Sun have no shifts)
- Should resume Monday morning
- Actual completion should be Monday afternoon
- Demonstrates multi-day pause handling

---

## Summary of Test Coverage

| Scenario | Tests Feature |
|----------|---------------|
| 1 | Work center conflicts, dependency cascades |
| 2 | Maintenance window avoidance, double shifts |
| 3 | Circular dependency detection (error handling) |
| 4 | Shift gaps (lunch breaks), non-continuous shifts |
| 5 | Multiple parent dependencies, complex graphs |
| 6 | Weekend spanning, multi-day delays |

## Expected Metrics

Each scenario should produce:
- ✅ **Total Duration**: Time from earliest start to latest end
- ✅ **Old Duration**: Original schedule duration
- ✅ **Total Delay**: Difference (negative = improvement)
- ✅ **Changed Work Orders**: Count of rescheduled orders
- ✅ **Execution Order**: Topologically sorted list
- ✅ **Change Explanations**: Why each order was rescheduled
