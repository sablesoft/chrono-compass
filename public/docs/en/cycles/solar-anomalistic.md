# Solar Anomalistic Cycle

## Overview

The **solar anomalistic cycle** describes the periodic variation of the **Earth–Sun distance** as the Earth moves along its elliptical orbit.

It is defined by the recurrence of:
- **perihelion** — Earth’s closest approach to the Sun,
- **aphelion** — Earth’s farthest distance from the Sun.

Unlike the tropical cycle, which is governed by axial tilt and illumination geometry, the anomalistic cycle is governed by **orbital shape and gravitational dynamics**.
In ChronoCompass, the solar anomalistic cycle is treated as a **distance-driven and gravitational-intensity cycle**.

---

## Cycle Definition

- Average duration: **~365.259636 days**
- Cycle type: **Earth–Sun distance extrema**
- Reference frame: Earth’s orbital ellipse

Astronomically, the anomalistic cycle runs from **perihelion to perihelion**.

In ChronoCompass, **East (E)** is used as the canonical structural start and end of the cycle.
This start point is not tied to a physical extremum, but to a **distance-equilibrium crossing**, allowing consistent directional semantics across all wheels.

---

## Directions and Anchors

The solar anomalistic wheel is anchored as follows:

| Direction | Astronomical Meaning |
|---------|---------------------|
| **E** | Crossing of the mean Earth–Sun distance (distance equilibrium) |
| **N** | **Aphelion** — maximum Earth–Sun distance |
| **W** | Second crossing of the mean distance |
| **S** | **Perihelion** — minimum Earth–Sun distance |
| **E+** | Next distance-equilibrium crossing |

Key principles:

- **N and S** are computed from true astronomical apsides  
  (via ephemeris-based search).
- **E and W** are **not time midpoints**, but are defined as moments when
  the Earth–Sun distance equals the **cycle’s mean distance**.
- All intermediate spokes are derived from **distance-linear interpolation**,
  not from uniform time division.

This makes the wheel **symmetric in distance**, while allowing time asymmetry to emerge naturally.

---

## Houses

- The wheel is divided into **16 houses**, centered on the 16 compass directions.
- Houses represent **equal steps in Earth–Sun distance**, not equal steps in time.
- Temporal duration of houses is therefore **uneven**.

This directly reflects **Kepler’s second law**:

- Earth moves **faster near perihelion**,
- and **slower near aphelion**.

As a result:
- houses near **South (perihelion)** are temporally compressed,
- houses near **North (aphelion)** are temporally expanded.

ChronoCompass preserves this asymmetry intentionally, allowing orbital dynamics to remain visible in the time structure.

---

## Meaning of Directions

### South (S) — Perihelion

- Earth is at its **minimum distance** from the Sun.
- Solar gravitational influence is **maximal**.
- Orbital velocity is highest.

From a gravitational perspective:

- The Sun’s gravitational vector is strongest.
- Earth experiences maximum orbital acceleration.

South represents:
- **maximum gravitational intensity**,
- compression,
- concentrated orbital energy,
- hidden force rather than visible illumination.

Importantly:
- Perihelion does *not* correspond to maximum warmth or brightness.
- Illumination depends on axial tilt, not distance.

---

### North (N) — Aphelion

- Earth is at its **maximum distance** from the Sun.
- Solar gravitational influence is **minimal**.
- Orbital velocity is lowest.

From a gravitational perspective:

- The Sun’s pull is weakest.
- The orbital system is maximally expanded.

North represents:
- **gravitational relief**,
- expansion,
- orbital freedom,
- minimal binding force.

North acts as the natural counterbalance to the compression expressed at South.

---

### East (E) and West (W)

- Transitional points between perihelion and aphelion.
- Defined by **true distance equilibrium**, not by temporal midpoint.

Structurally:

- At E and W, Earth crosses the mean Earth–Sun distance.
- Orbital motion transitions between acceleration and deceleration regimes.

In ChronoCompass:
- **East marks both the beginning and completion of the anomalistic cycle**,
- providing a stable, non-extremal anchor compatible with all other wheels.

---

## Interaction with Other Cycles

The solar anomalistic cycle interacts with:

- **Solar Tropical Cycle**  
  (illumination and seasonal geometry)

- **Diurnal Cycle**  
  (local solar altitude modulation)

- **Lunar Anomalistic Cycle**  
  (compound gravitational effects)

Examples:
- Perihelion near a solstice slightly enhances seasonal asymmetry.
- Distance modulation affects tidal strength and eclipse intensity.
- Long-term resonance patterns emerge when anomalistic and tropical cycles drift.

---

## Computational Precision

- Aphelion and perihelion are computed using **ephemeris-based astronomical search**.
- Intermediate spokes are solved by **numerical root finding** for distance equality.
- Typical accuracy is **better than one minute**, often significantly finer.
- The system is deterministic and reproducible within the supported ephemeris range.

ChronoCompass prioritizes **physical correctness over geometric convenience**.

---

## Practical Applications

The solar anomalistic wheel is useful for:

- understanding variations in Earth–Sun distance,
- visualizing orbital speed changes,
- explaining unequal season durations,
- estimating gravitational modulation of tides,
- contextualizing eclipse magnitude variations,
- educational demonstration of Keplerian motion.

---

## Conceptual Role in ChronoCompass

The anomalistic cycle answers the question:

> *How strongly is Earth gravitationally bound to the Sun right now?*

It complements:
- the **tropical cycle** (orientation and illumination),
- without overlapping or replacing it.

Together, they describe:
- **where Earth is oriented**, and
- **how tightly it is bound**.

---

## Summary

- The solar anomalistic cycle governs **Earth–Sun distance and orbital speed**.
- South corresponds to **maximum gravitational compression (perihelion)**.
- North corresponds to **maximum orbital expansion (aphelion)**.
- East and West represent **true distance equilibrium crossings**.
- House durations are unequal due to Kepler’s laws.
- Spokes are distance-linear, not time-linear.

ChronoCompass treats the solar anomalistic cycle as the **gravitational counterpart to the seasonal (tropical) year**.