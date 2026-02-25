# ClearCut Demo Data Generator

## Overview

The demo data system generates realistic paratransit trip and route data for ClearCut. It consists of two parts:

1. **Location population script** — fetches real addresses from 15 US cities via Mapbox Search Box API and stores them in a SQLite database
2. **Demo data generator** — reads from the locations database, picks a random city, and generates two weeks of route/trip data with realistic timing, distances, and passenger distributions

## Prerequisites

- Mapbox token configured in `website/.env.local` as `NEXT_PUBLIC_MAPBOX_TOKEN`
- Node.js with `tsx` available (`npx tsx`)

## Quick Start

### 1. Populate the locations database

```bash
cd website
npx tsx scripts/populate-demo-locations.ts
```

This creates `website/data/clearcut/demo-locations.db` with ~800 real addresses across 15 cities. The script uses the Mapbox Search Box API (category + forward search) and Geocoding v5 (reverse geocoding for residential). Hard limit of 25,000 API requests.

The script is **append-only** — re-running it will only fetch locations for cities that are missing data. Existing entries are preserved.

### 2. Load demo data in the app

Click the **Load Demo Dataset** button on the Import tab. The server picks a random city from the locations database and generates 14 days of paratransit data.

---

## Location Population Script

**File:** `website/scripts/populate-demo-locations.ts`

**Run:** `npx tsx scripts/populate-demo-locations.ts`

### Configuration

All configuration is in the `CONFIG` object at the top of the script:

| Variable | Default | Description |
|----------|---------|-------------|
| `apiRequestHardLimit` | `25,000` | Absolute max API calls before script aborts (free tier is 50K/month) |
| `apiDelayMs` | `200` | Milliseconds between API requests (rate limiting) |
| `cityIndices` | `null` | Set to array of indices (e.g. `[0, 1, 2]`) to only populate specific cities. `null` = all 15 cities |
| `destinationsPerCity` | `20` | Medical facilities, senior centers, government offices per city |
| `residentialPerCity` | `33` | Residential addresses per city (via reverse geocoding) |
| `depotsPerCity` | `3` | Warehouse/transit facility locations per city |
| `searchRadiusMiles` | `5.64` | Search radius from city center (~100 sq mi area) |
| `reverseGeocodingOversample` | `2.5` | Try this many random points per residential address needed |
| `maxResultDistanceMiles` | `8.0` | Max distance from city center to accept a result |
| `destinationCategories` | see below | Search Box API category IDs for POI search (up to 25 results each) |
| `destinationSearchTerms` | see below | Supplemental forward search terms (up to 10 results each) |
| `depotSearchTerms` | see below | Depot forward search terms |

**Destination categories (Search Box API):** hospital, pharmacy, dentist, doctor, clinic, optometrist, library, community_center, government_office, nursing_home

**Destination forward search terms (supplemental):** dialysis center, senior center, assisted living, rehabilitation center, VA hospital, urgent care, mental health clinic, social services

**Depot search terms:** warehouse, bus depot, transit center, industrial park, storage facility, distribution center

### Append-Only Behavior

The script is append-only by default. When re-run:
- Cities already at target counts are skipped entirely
- Partially populated cities only fetch the remaining needed locations
- Existing addresses are loaded for deduplication
- No data is deleted or overwritten

### Cities

The script populates addresses for 15 US cities (population 100k+):

| City | State | Region |
|------|-------|--------|
| Columbus | OH | Midwest |
| Charlotte | NC | Southeast |
| Tucson | AZ | Southwest |
| Richmond | VA | East Coast |
| Boise | ID | Northwest |
| Albuquerque | NM | Southwest |
| Omaha | NE | Midwest |
| Knoxville | TN | Southeast |
| Spokane | WA | Northwest |
| Des Moines | IA | Midwest |
| Reno | NV | West |
| Chattanooga | TN | Southeast |
| Fort Wayne | IN | Midwest |
| Shreveport | LA | South |
| Tallahassee | FL | Southeast |

### Database Schema

**File:** `website/data/clearcut/demo-locations.db`

```
cities (city_id, name, state, center_lat, center_lon)
locations (location_id, city_id, category, address, lat, lon, place_name)
```

Categories: `destination`, `residential`, `depot`

---

## Demo Data Generator

**File:** `website/lib/clearcut/demo-data.ts`

Called server-side when a user clicks "Load Demo Dataset". The function `buildDemoTripsAndRoutes()` returns `{ trips, routes, depots }`.

### Configuration

All parameters are in the `DEMO_CONFIG` export at the top of the file:

#### Time Period
| Variable | Default | Description |
|----------|---------|-------------|
| `dayCount` | `14` | Number of days to generate |
| `startDate` | `2026-02-02` | First day (a Monday) |

#### Service Window
| Variable | Default | Description |
|----------|---------|-------------|
| `serviceStartHour` | `6` | 6:00 AM |
| `serviceEndHour` | `19` | 7:00 PM |

#### Routes
| Variable | Default | Description |
|----------|---------|-------------|
| `routesPerDayMin` | `8` | Minimum routes per day |
| `routesPerDayMax` | `15` | Maximum routes per day |
| `routeStartWindowMinutes` | `90` | Routes stagger across this window from service start |
| `routeDurationMinHours` | `10` | Minimum route duration |
| `routeDurationMaxHours` | `12` | Maximum route duration |
| `routeActualStartVarianceMin/Max` | `-5 / +10` | Minutes offset from scheduled start |
| `routeActualEndVarianceMin/Max` | `-15 / +5` | Minutes offset from scheduled end |
| `break1OffsetMinutes` | `150` | Break 1 at ~2.5 hours after route start |
| `break2OffsetMinutes` | `330` | Break 2 at ~5.5 hours after route start |
| `breakVarianceMinutes` | `15` | +/- variance on break times |

#### Trips
| Variable | Default | Description |
|----------|---------|-------------|
| `productivityMin` | `1.5` | Min trips per route-hour |
| `productivityMax` | `2.2` | Max trips per route-hour |
| `speedMph` | `30` | Flat speed for time calculations |
| `roadFactorMultiplier` | `1.3` | Haversine distance x this = estimated road distance |
| `demandBlockSizeMinutes` | `15` | Time block size for demand distribution |

#### Passenger Types
| Variable | Default | Description |
|----------|---------|-------------|
| `passengerTypeAmbulatoryPct` | `0.65` | 65% ambulatory |
| `passengerTypeWheelchairPct` | `0.25` | 25% wheelchair |
| `passengerTypeExtraLargePct` | `0.10` | 10% extra large wheelchair |

#### Trip Status Distribution
| Variable | Default | Description |
|----------|---------|-------------|
| `statusCompletedPct` | `0.92` | 92% completed |
| `statusNoShowPct` | `0.08` | 8% no-show (only pickup arrive populated) |

#### Dwell Times
| Variable | Default | Description |
|----------|---------|-------------|
| `dwellTimeAmbulatoryMin/Max` | `1 / 3` | Used to compute average (2 min) for ambulatory |
| `dwellTimeWheelchairMin/Max` | `3 / 15` | Used to compute average (9 min) for wheelchair/XL |

Actual times use the **average** of min/max, not a random value within the range.

#### Address Weighting
| Variable | Default | Description |
|----------|---------|-------------|
| `pickupResidentialWeight` | `0.80` | 80% of pickups from residential addresses |
| `pickupDestinationWeight` | `0.20` | 20% of pickups from destination addresses |
| `dropoffDestinationWeight` | `0.70` | 70% of dropoffs to destinations (medical, etc.) |
| `dropoffResidentialWeight` | `0.30` | 30% of dropoffs to residential |

#### OTP (On-Time Performance)
| Variable | Default | Description |
|----------|---------|-------------|
| `pickupOtpWindowBeforeMin` | `15` | On-time if arrive up to 15 min before scheduled pickup |
| `pickupOtpWindowAfterMin` | `15` | On-time if arrive up to 15 min after scheduled pickup |
| `dropoffOtpWindowBeforeMin` | `30` | On-time if arrive up to 30 min before appointment |
| `dropoffOtpWindowAfterMin` | `1` | On-time if arrive up to 1 min after appointment |
| `otpFloorPct` | `55` | Minimum OTP target for any dataset |
| `otpCeilPct` | `95` | Maximum OTP target for any dataset |
| `otpBiasCenterPct` | `85` | Center of OTP bias distribution |
| `otpBiasWeight` | `0.75` | 75% chance OTP lands near center (80-90%) |
| `maxPickupToAppointmentMinutes` | `60` | Max gap between scheduled pickup and appointment |

#### Shared Rides
| Variable | Default | Description |
|----------|---------|-------------|
| `sharedRidePct` | `0.20` | 20% of completed trips generate a shared ride companion |

#### Weekend Adjustments
| Variable | Default | Description |
|----------|---------|-------------|
| `weekendRouteReduction` | `0.6` | Multiply route count range by this on weekends |
| `weekendTripReduction` | `0.65` | Multiply trip target by this on weekends |

#### Other
| Variable | Default | Description |
|----------|---------|-------------|
| `seed` | `20260213` | Deterministic random seed |
| `odometerBasePerRoute` | `10000` | Starting odometer per route |
| `odometerRouteSpacing` | `500` | Odometer spacing between routes |

### Generation Algorithm

1. **Pick city** — selects a random city from the locations DB using the seeded random
2. **Build depots** — takes 2-3 depot locations from the city's warehouse/transit facilities; names use street name from address
3. **Pick OTP targets** — dataset-wide pickup and dropoff OTP targets (55-95%, biased toward 85%)
4. **Generate routes** — 8-15 per day, staggered start times across 6:00-7:30 AM, 6-10.5 hour durations, assigned to depots round-robin
5. **Generate trips per block** — for each 15-min demand block with active routes, trip count = `activeRouteHours × productivity × demandWeight / avgWeight`
6. **Appointment-first scheduling** — appointment time on 15-min step, pickup = appointment - ride - dwell on 15-min step, within 60 min
7. **Assign trips to routes** — greedy nearest-neighbor to pickup among active routes
8. **OTP-driven actual times** — roll against OTP target for on-time (within window) vs late (beyond window) for both pickup and dropoff. Dwell times use fixed averages.
9. **Shared rides** — 20% of completed trips generate a companion trip on the same route with staggered timing
10. **Compute distances** — haversine × 1.3 road factor for odometers; route distance fields computed from depot↔first pickup and last dropoff↔depot

### Expected Output

- ~140 route records (14 days x ~10 routes)
- ~1,400-2,000 trip records (varies with productivity target)
- 2-3 depot records
- All trips have real addresses and lat/lon coordinates
- Odometer readings are monotonically increasing per route

---

## File Reference

| File | Purpose |
|------|---------|
| `website/scripts/populate-demo-locations.ts` | Mapbox Search Box + Geocoding API script to build locations DB |
| `website/lib/clearcut/demo-cities.ts` | 15 US cities with center coordinates |
| `website/lib/clearcut/demo-locations-db.ts` | SQLite read/write helpers for locations DB |
| `website/lib/clearcut/demo-data.ts` | Trip/route generation algorithm |
| `website/lib/clearcut/config.ts` | `getDemoLocationsDbPath()` helper |
| `website/app/api/clearcut/sessions/[token]/demo/route.ts` | API endpoint (POST) |
| `website/lib/clearcut/client.ts` | `loadDemoData()` client function |
| `website/lib/clearcut/use-clearcut-session.ts` | `loadDemo` hook method |
| `website/data/clearcut/demo-locations.db` | Generated locations database |
