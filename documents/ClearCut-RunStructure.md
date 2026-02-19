# ClearCut Run Structure & Metrics

## Overview

The Run Structure tab provides tools to analyze current route schedules and generate optimized route plans based on demand patterns. It uses two key modules:

- **`lib/clearcut/metrics.ts`** — Computes demand metrics, vehicle counts, productivity, and deadhead from raw trip/route data
- **`lib/clearcut/run-structure.ts`** — Builds the current average run cut and generates optimized routes
- **`components/ui/RunStructureTab.tsx`** — UI component with optimization parameter sliders, charts, and route tables

---

## Metrics Computation (`metrics.ts`)

### Time Blocks

The service day is divided into fixed-size time blocks (default 15 minutes). Each block tracks:

- **Pickups** — Average daily trip pickups in that block
- **On-Board Trips** — Cumulative active trips based on average ride duration (trips that started but haven't ended yet)
- **Vehicles** — Average daily unique vehicles active in that block

### Key Metrics

| Metric | Description |
|--------|-------------|
| `pickupsByBlock` | Average daily pickups per time block |
| `onBoardByBlock` | Active (on-board) trips per block — accounts for ride duration, not just pickup moment |
| `vehiclesByBlock` | Average unique vehicles operating per block |
| `peakVehicles` | Maximum vehicles active in any single block |
| `avgProductivity` | Total daily trips / total daily vehicle-hours (system-wide efficiency) |

### On-Board Trip Calculation

For each block, on-board trips are computed by looking back from the current block by the average ride duration. Any trip picked up within that lookback window and not yet dropped off counts as "on board." This gives a more accurate picture of how many trips a vehicle is handling simultaneously compared to raw pickup counts.

### Deadhead Calculation (Distance-Based)

Deadhead represents non-revenue travel time (e.g., driving from the yard to the first pickup, or from the last dropoff back to the yard). It is computed from odometer data:

1. **Group trips** by `route_id` + date to avoid cross-day odometer gaps
2. **Sort** each group by pickup time
3. **Compute inter-trip gaps**: For consecutive trips on the same route-day, calculate `next_trip.pick_odometer - current_trip.drop_odometer`
4. **Cap** each gap at 30 miles to filter outliers
5. **Start deadhead** = average of the *first* inter-trip gap per route-day (proxy for yard → first pickup)
6. **End deadhead** = average of the *last* inter-trip gap per route-day (proxy for last dropoff → yard)
7. **Convert to time**: `minutes = (miles / 35) * 60` at an assumed average speed of 35 mph

Output fields:
- `avgStartDeadheadMinutes` — Applied to shift start times in the optimizer
- `avgEndDeadheadMinutes` — Applied to shift end times in the optimizer

### Full-Day vs Filtered Metrics

Two metric instances are computed:

- **`fullDayMetrics`** — Computed over the entire service day with no time range filter. Used by the optimizer algorithm, stats tables, and parameter sliders.
- **`metrics`** — Computed with the user's selected time range filter. Used only for the chart viewport.

This separation ensures the time range slider acts as a *view filter* only and does not affect optimization results.

---

## Current Run Cut (`run-structure.ts` → `buildCurrentRunCut`)

Builds the average schedule from existing route data:

1. **Filter routes** to selected days of the week
2. **Group by route name** and collect start/end times (minutes since midnight)
3. **Average** the start and end times across all matching days for each route
4. **Round up** to the nearest block interval (e.g., 15 min)
5. **Map** each route to the time blocks it covers (active block indices)
6. **Sort** by earliest active block

Output: A table showing each route's average shift start, end, and duration.

---

## Optimized Route Generation (`run-structure.ts` → `buildOptimizedRoutes`)

### Parameters

| Parameter | Description |
|-----------|-------------|
| `targetProductivity` | Desired trips per vehicle-hour (slider, default 2.0) |
| `maxShiftHours` | Maximum shift length (slider, default 12 hrs) |
| `minShiftHours` | Minimum shift length (slider, default 4 hrs) |
| `peakVehicles` | Maximum vehicles allowed (slider, default = actual peak) |
| `startDeadheadMinutes` | Computed start deadhead time (from metrics) |
| `endDeadheadMinutes` | Computed end deadhead time (from metrics) |

### Algorithm

The optimizer uses a **layer-based vehicle assignment** approach:

1. **Compute required vehicles per block**: For each time block, divide on-board trips by target productivity, capped at peak vehicles:
   ```
   required[block] = min(peakVehicles, ceil(onBoardTrips[block] / targetProductivity))
   ```

2. **Layer vehicles**: For layer N (1 through max required):
   - Find all blocks where `required[block] >= N`
   - These are the blocks that need at least N vehicles

3. **Group into contiguous spans**: Adjacent qualifying blocks form a single span (potential shift)

4. **Split long spans**: If a span exceeds `maxShiftBlocks`, split it into chunks

5. **Pad short spans**: If a chunk is shorter than `minShiftBlocks`, extend it into adjacent blocks to meet minimum shift length

6. **Apply deadhead offsets**:
   - Shift start = first active block start - `ceil(startDeadheadMinutes / blockSize) * blockSize`
   - Shift end = last active block end + `ceil(endDeadheadMinutes / blockSize) * blockSize`
   - Deadhead is snapped to block boundaries (15-min increments)

7. **Sort and renumber**: Routes are sorted by start time and numbered sequentially (Vehicle 1, 2, 3, ...)

### Example

If demand requires 5 vehicles at peak and 2 at off-peak:
- Layer 1-2: Full-day shifts covering the entire demand window
- Layer 3-5: Peak-only shifts covering just the high-demand blocks
- Each shift gets deadhead padding at the start and end

---

## UI Components (`RunStructureTab.tsx`)

### Optimization Parameters Section

Four sliders with draft/ref pattern for smooth dragging:
- **Target Productivity** — Shows actual vs target
- **Min Shift Length** — Minimum hours per shift
- **Max Shift Length** — Shows actual average vs max
- **Peak Vehicles** — Shows actual vs target

Values persist to the database via `onOptimizationChange` on pointer-up.

### Demand & Vehicle Coverage Chart

- **Bars**: Demand (pickups/on-board) from filtered `metrics` (respects time range)
- **Solid teal line**: Current vehicle count from filtered `metrics`
- **Dashed amber line**: Optimized vehicle count (full-day optimization mapped onto filtered view blocks)

### Stats & Route Tables

- **Average Run Cut**: Current routes with avg daily trips, total hours, peak vehicles, and productivity
- **Optimized Routes**: Generated routes with same stats for comparison

Both tables use `fullDayMetrics` (unfiltered) so results remain stable regardless of the time range slider.

---

## Key Design Decisions

1. **On-board trips over raw pickups**: Vehicle requirements are based on active (on-board) trips, which accounts for ride duration and gives a more realistic demand picture.

2. **Distance-based deadhead**: Uses odometer data rather than time gaps between route start/end and first/last trip, providing more accurate non-revenue travel estimates.

3. **Separate start/end deadhead**: Start and end deadhead are computed independently since yard-to-first-pickup distance often differs from last-dropoff-to-yard.

4. **Block-snapped deadhead**: Deadhead offsets are rounded up to block boundaries (15-min increments) so shift times align cleanly with the time block grid.

5. **Full-day optimization**: The optimizer always runs on the full service day regardless of the time range filter, ensuring consistent results. The filter only affects the chart viewport.

6. **30-mile deadhead cap**: Inter-trip odometer gaps are capped at 30 miles to filter out data anomalies like cross-day gaps or odometer resets.
