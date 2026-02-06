# Diurnal Cycle (Earth Rotation)

## Overview

The **diurnal cycle** represents the rotation of the Earth around its axis relative to the Sun.

It is the most immediate and intuitive cycle in ChronoCompass, forming the foundation for:
- local time,
- day and night,
- illumination,
- daily biological and environmental rhythms.

The diurnal wheel is **location-dependent** and changes with latitude and longitude.

---

## Physical Definition

The diurnal cycle is defined by:
- one full rotation of the Earth (~24 hours),
- measured relative to the Sun (solar day),
- affected by Earth’s axial tilt and orbital motion.

Unlike a purely mechanical 24-hour clock, the diurnal cycle:
- varies in daylight duration across the year,
- varies in structure depending on latitude.

Astronomically, the diurnal cycle is continuous and has no natural absolute beginning.
In ChronoCompass, East (E) — corresponding to sunrise — is consistently treated as the formal start and end of the diurnal cycle, preserving a unified directional structure across all wheels.

---

## Astronomical Anchors

The diurnal wheel is built from **solar position events**:

### Main Anchors

- **E — Sunrise**
- **N — Local Solar Noon** (Sun at highest altitude)
- **W — Sunset**
- **S — Local Solar Midnight** (Sun at lowest altitude)

These anchors are computed **astronomically**, based on:
- observer latitude and longitude,
- current date,
- solar ephemerides.

---

## Wheel Mapping

### Direction Mapping

| Direction | Meaning        |
|-----------|----------------|
| E         | Sunrise        |
| N         | Solar Noon     |
| W         | Sunset         |
| S         | Solar Midnight |
| E+        | Next Sunrise   |

Intermediate directions are derived mathematically between these anchors.

---

## Houses and Unequal Duration

### Day vs Night Asymmetry

The diurnal wheel is a clear example of **unequal house duration**.

- The arc **E → N → W** represents **daytime**
- The arc **W → S → E** represents **nighttime**

In most locations and seasons:
- daytime ≠ nighttime,
- therefore houses on the day side and night side have different temporal lengths.

This asymmetry:
- reflects real solar motion,
- is preserved intentionally in ChronoCompass,
- avoids false geometric simplification.

---

## Latitude Dependence

The diurnal cycle strongly depends on latitude:

- Near the equator:
    - day and night are nearly equal year-round.
- At mid-latitudes:
    - day/night ratio changes with seasons.
- Near the polar circles:
    - houses may collapse or expand dramatically.
- Beyond the polar circles:
    - sunrise or sunset may not occur at all.

ChronoCompass handles these edge cases explicitly.

---

## Meaning of Directions

### North (N) — Solar Noon

- Maximum solar altitude above the horizon.
- Maximum illumination at the observer’s location.

From a gravitational perspective:

- At solar noon, the Sun is approximately **above the observer**.
- The Sun’s gravitational vector is therefore directed **upward**, opposite to the dominant gravitational vector of the Earth’s center.
- As a result, the solar gravitational contribution slightly **reduces the effective gravitational load** experienced by the observer.

Although this effect is extremely small in absolute magnitude, it is conceptually important:
- North often represents a point of **relative gravitational relief**,
- increased dynamism,
- and maximal exposure to external (solar) influence.

This contributes to the interpretation of North as a phase of openness, expansion, and freedom within the cycle.

### South (S) — Solar Midnight

- Minimum solar altitude.
- Maximum darkness.
- The Sun is located on the opposite side of the Earth relative to the observer.

From a gravitational perspective:

- At solar midnight, the Sun lies roughly **below the observer**, near the nadir.
- The Sun’s gravitational vector is therefore aligned **in the same direction** as the Earth’s central gravitational vector.
- This causes a slight **increase in effective gravitational load** on the observer.

Again, while the magnitude is tiny, the geometry is meaningful:
- South corresponds to a point of **maximum hidden gravitational influence**,
- compression,
- and inward-directed forces.

This makes South a natural representation of accumulation, convergence, and the “invisible” side of the cycle.

### East (E) and West (W)

- Transitional points between day and night.
- Moments of balance and inversion between illumination states.
- In ChronoCompass, East always serves as both the **beginning and completion** of the cycle.

---

## Precision

- Calculations are accurate to **minute-level precision**.
- Boundary conditions (e.g. polar day/night) are explicitly detected.
- No approximation is used when astronomical data is available.

---

## Practical Applications

The diurnal wheel is useful for:
- understanding local solar time,
- comparing illumination across locations,
- aligning events with daylight or darkness,
- educational demonstrations of Earth rotation,
- anchoring other cycles visually and conceptually, 
- determining the local visibility of certain astronomical phenomena.

---

## Role in the Unified Compass Model

The diurnal cycle:
- establishes the basic meaning of E/N/W/S directions,
- demonstrates unequal house duration clearly,
- grounds the compass model in direct physical experience.

Because of its immediacy and familiarity, it acts as the **baseline wheel** against which many other cycles can be intuitively compared.

---

## Notes

- The diurnal cycle is independent of lunar and seasonal cycles.
- Apparent synchronization with other wheels is temporary and coincidental.
- Drift between diurnal, lunar, and solar cycles is expected and meaningful.