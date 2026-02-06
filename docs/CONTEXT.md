# ChronoCompass — Project Context

## Overview

**ChronoCompass** is an interactive application for exploring time through multiple independent cyclical systems (“wheels”), primarily based on real astronomical cycles.

The application is designed as a **thinking and analysis tool**, combining:
- scientific and astronomical accuracy,
- visual and temporal intuition,
- educational clarity,
- and optional symbolic, metaphysical, and philosophical interpretation.

At its core, the project aims to establish a **simple, logical, precise, and accessible standard** for representing diverse temporal cycles.

ChronoCompass does this by mapping fundamentally different cycles  onto a **single, shared compass-based model** — using directions, houses, and rotational geometry as a common language for time.

---

## Directions and Houses

Each wheel is mapped onto a circular structure with **directions** and **houses**.

### Directions

- Every wheel contains **16 compass directions**:
    - 4 main directions: **E, N, W, S**
    - 12 intermediate directions (ENE, NE, NNE, …)

Directions are represented as **spokes** of the wheel and act as reference axes for positioning events in time.

### Houses

- The wheel is also divided into **16 houses**.
- A **house** is the temporal sector centered on a direction (spoke).
- Houses are defined by boundaries between neighboring directions.

⚠️ **Important:**  
Houses are **not always equal to exactly 1/16 of the cycle duration**.

Depending on the nature of the cycle, houses may have **unequal temporal lengths within the same wheel**.

#### Example: Diurnal (Day/Night) Cycle

- In the diurnal wheel:
    - the daytime arc (E → N → W),
    - and the nighttime arc (W → S → E)
      usually have **different durations**.
- As a result:
    - daytime houses and nighttime houses are not equal in length,
    - even though they remain structurally symmetric on the wheel.

This asymmetry is intentional and reflects real astronomical conditions rather than a simplified geometric model.

### Main Directions (E / N / W / S)

- The four main directions are **structural anchors** of each wheel.
- Depending on the cycle:
    - all four main directions may be computed using astronomical formulas, or
    - only some directions are astronomically defined, while the remaining ones are derived mathematically (midpoints, symmetry, interpolation).

This distinction is explicit and varies per cycle.

### Practical and Analytical Use

Directions and houses are not merely visual aids.

They are especially useful for **applied analytical tasks**, for example:
- estimating the **probability of eclipses**,
- distinguishing **types of eclipses** (solar vs lunar, central vs partial),
- analyzing resonance between multiple cycles,
- comparing how different cycles align or drift relative to each other.

The combination of:
- unequal house durations,
- astronomically anchored directions,
- and consistent structural geometry

allows ChronoCompass to represent complex temporal phenomena in a way that is both accurate and intuitively readable.

---

## Cycles

The application supports multiple independent cycles, including (but not limited to):

- Diurnal (Earth rotation)
- Lunar Synodic (Moon phases)
- Lunar Draconic (nodes, eclipses)
- Lunar Anomalistic (Earth–Moon distance)
- Solar Tropical (seasons)
- Solar Anomalistic (Earth–Sun distance)
- Axial Precession (Plato / Platonic Year)

Each cycle:
- has its own length,
- its own reference points,
- and its own physical meaning.

Cycles are **not forced to align** with each other.

---

## Time Precision

- Most astronomical cycles are calculated with **minute-level precision**.
- The system is designed to be deterministic and reproducible.
- Boundary conditions are handled explicitly to avoid ambiguity.

---

## Moments and Collections

ChronoCompass allows working not only with “now”, but with **time as data** in the past and the future.

### Moments

- Any moment in time can be saved with:
    - a name,
    - a description.

- Moments can be:
    - absolute (single timestamps),
    - or **periodic** (recurring events with custom periods):
        - birthdays,
        - monthly or yearly events,
        - custom cycles.

### Collections

- Moments are grouped into **collections**.
- Each collection can be:
    - enabled or disabled,
    - shown or hidden per wheel,
    - assigned to a specific orbital radius on a wheel,
    - visually compared with other collections.

Collections are a core analytical feature, not just a UI convenience.

---

## Location Awareness

- The application supports **multiple Earth locations**.
- Locations can be:
    - entered manually (latitude / longitude),
    - saved and reused,
    - switched instantly.

- Astronomical calculations react to location where relevant (e.g. diurnal cycle).

---

## Offline-First Design

- ChronoCompass works **fully offline**.
- It can be installed as a **Progressive Web App (PWA)**.
- No internet connection is required for:
    - calculations,
    - navigation,
    - saved data.

Internet access is used **only** for:
- checking application updates,
- optional automatic detection of current geographic location.

---

## Intended Use

ChronoCompass is intentionally **multi-layered**.

It can be used equally for:
- scientific and astronomical analysis,
- education and teaching,
- visualization of complex time relationships,
- philosophical reflection,
- metaphysical, symbolic, or esoteric exploration.

The application does not enforce interpretation.  
It provides structure, accuracy, and clarity — meaning is left to the user.

---

## Design Philosophy

- Accuracy over convenience.
- Independence of cycles over artificial harmony.
- Visual intuition over raw tables.
- Explicit structure over hidden assumptions.

ChronoCompass treats time not as a line, but as a **system of interacting cycles**.