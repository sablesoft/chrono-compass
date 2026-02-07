# Diurnal Cycle (Earth Rotation)

## Overview

The **diurnal cycle** represents the rotation of the Earth around its axis relative to the Sun.

It is the most immediate and intuitive cycle in ChronoCompass, forming the foundation for:
- local solar time,
- day and night,
- illumination,
- daily biological and environmental rhythms.

The diurnal wheel is **location-dependent** and varies with latitude, longitude, and season.

---

## Physical Definition

The diurnal cycle is defined by:
- one full rotation of the Earth relative to the Sun (solar day),
- continuous apparent motion of the Sun across the local sky,
- modulation by Earth’s axial tilt and orbital position.

Astronomically, the diurnal cycle has **no intrinsic absolute start**.
In ChronoCompass, **East (E)** is consistently chosen as the formal start/end point to provide a stable directional and visual convention across all wheels.

---

## Astronomical Basis

ChronoCompass defines the diurnal cycle strictly through **astronomical geometry**, not clock conventions.

All anchors are derived from:
- observer latitude and longitude,
- exact solar ephemerides,
- apparent solar altitude (including refraction where applicable).

The model treats the Sun’s motion as **continuous**, even when discrete events (sunrise/sunset) are absent.

---

## Core Anchors

### Primary Anchors

When solar horizon crossings exist, the diurnal cycle is anchored by:

- **E — Sunrise**  
  Moment when the Sun crosses the horizon upward.

- **N — Local Solar Noon**  
  Moment of maximum solar altitude.

- **W — Sunset**  
  Moment when the Sun crosses the horizon downward.

- **S — Local Solar Midnight**  
  Moment of minimum solar altitude.

- **E+ — Next Sunrise**  
  The next upward horizon crossing, closing the cycle.

These anchors are **event-based**, not clock-based.

---

## Wheel Mapping

### Direction Mapping

| Direction | Meaning              |
|-----------|----------------------|
| E         | Sunrise              |
| N         | Solar Noon           |
| W         | Sunset               |
| S         | Solar Midnight       |
| E+        | Next Sunrise         |

Intermediate directions are interpolated mathematically between anchors and therefore inherit unequal temporal spacing.

---

## Unequal Duration and Asymmetry

### Day vs Night

The diurnal wheel explicitly preserves **unequal house duration**.

- **E → N → W** represents the illuminated (day) arc.
- **W → S → E** represents the dark (night) arc.

In general:
- day ≠ night,
- seasonal and latitudinal asymmetry is the norm, not an exception.

ChronoCompass preserves this asymmetry intentionally to reflect real solar motion rather than imposing artificial symmetry.

---

## Latitude Dependence and Polar Behavior

The structure of the diurnal cycle depends strongly on latitude:

- **Equatorial regions**
  - Day and night are nearly equal year-round.
- **Mid-latitudes**
  - Day/night duration varies seasonally.
- **Near the polar circles**
  - Day or night segments may shrink to minutes.
- **Beyond the polar circles**
  - Sunrise and/or sunset may disappear entirely for extended periods.

### Polar Day and Polar Night

ChronoCompass distinguishes three physical regimes:

1. **Normal regime**
  - Sunrise and sunset both occur.
  - All four anchors (E, N, W, S) are present.

2. **Polar Day (Midnight Sun)**
  - The Sun remains above the horizon.
  - No sunrise or sunset occurs during this interval.
  - The diurnal cycle spans from the **last real sunrise** before polar day to the **first real sunrise** after it.
  - The “day” arc may last weeks or months.

3. **Polar Night**
  - The Sun remains below the horizon.
  - No sunrise or sunset occurs.
  - The diurnal cycle spans from the **last real sunrise** before polar night to the **first real sunrise** after it.
  - The “night” arc dominates the wheel.

In polar regimes:
- the diurnal cycle may be extremely asymmetric,
- cycles may span far longer or shorter than 24 hours,
- this behavior is **intentional and physically correct**.

---

## Meaning of Directions

### North (N) — Solar Noon

- Maximum solar altitude.
- Maximum local illumination.

From a gravitational geometry perspective:
- The Sun is approximately above the observer.
- The solar gravitational vector opposes Earth’s central gravity.
- This slightly reduces effective gravitational load.

Conceptually, North represents:
- openness,
- exposure,
- expansion,
- external influence.

---

### South (S) — Solar Midnight

- Minimum solar altitude.
- Maximum darkness.

From a gravitational geometry perspective:
- The Sun lies roughly below the observer.
- The solar gravitational vector aligns with Earth’s gravity.
- This slightly increases effective gravitational load.

Conceptually, South represents:
- compression,
- inward direction,
- hidden or latent influence.

---

### East (E) and West (W)

- Transitional thresholds between illumination states.
- Points of inversion and balance.
- East is always treated as both the **entry** and **completion** of the diurnal cycle, even when separated by long polar intervals.

---

## Precision and Robustness

- Astronomical events are computed with **minute-level accuracy**.
- Only true geometric horizon crossings are treated as sunrise/sunset.
- Grazing contacts without sign change are ignored.
- Polar regimes are handled explicitly rather than approximated.
- No artificial 24-hour fallback is used unless explicitly required for UI stability.

---

## Practical Applications

The diurnal wheel supports:
- understanding local solar time,
- comparing illumination across locations,
- visualizing extreme polar conditions,
- education in Earth–Sun geometry,
- anchoring other cycles conceptually,
- interpreting daily rhythms in physical context.

---

## Role in the Unified Compass Model

The diurnal cycle:
- establishes the fundamental meaning of E/N/W/S,
- demonstrates unequal temporal structure clearly,
- grounds the entire compass model in direct physical reality.

Because of its immediacy and universality, it serves as the **baseline reference cycle** against which all other wheels can be intuitively compared.

---

## Notes

- The diurnal cycle is independent of lunar and seasonal cycles.
- Apparent synchronization with other wheels is temporary and coincidental.
- Drift between diurnal, lunar, and solar cycles is expected and meaningful.