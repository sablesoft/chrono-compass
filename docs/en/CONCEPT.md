# ChronoCompass — Project Concept

## Overview

**ChronoCompass** is an interactive application for exploring time through multiple independent cyclical systems (“wheels”), primarily based on real astronomical cycles.

The application is designed as a **thinking and analysis tool**, combining:
- scientific and astronomical accuracy,
- visual and temporal intuition,
- educational clarity,
- and optional symbolic, metaphysical, and philosophical interpretation.

At its core, the project aims to establish a **simple, logical, precise, and accessible standard** for representing diverse temporal cycles. ChronoCompass does this by mapping fundamentally different cycles  onto a **single, shared compass-based model** — using directions, houses, and rotational geometry as a common language for time.

---

## Unified Compass Model

A central goal of ChronoCompass is to define a **unified visual and conceptual standard**
for working with time cycles.

Instead of inventing a separate representation for each phenomenon,
the application maps fundamentally different cycles onto a **single compass-based model**,
using directions, houses, and rotational geometry as a common language for time.

### Directional Anchoring

Each cycle has a small number of **focal astronomical or physical points**
(equinoxes, solstices, apsides, nodes, culminations, etc.).

In ChronoCompass, these focal points are **deliberately and consistently bound**
to specific compass directions.

This binding is not arbitrary:
- it is based on physical meaning,
- temporal symmetry or asymmetry,
- and the functional role of the event within the cycle.

As a result:
- the same compass directions acquire **stable semantic tendencies** across different cycles,
- and similar directional positions tend to correspond to analogous states of a cycle,
  even when the underlying physics is different.

### Emergent Patterns

Across many cycles, certain **recurring patterns** can be observed.

These are not imposed rules, but **structural regularities** that emerge
from the way focal points are anchored.

#### South (S)

- The South direction often corresponds to **maximal gravitational influence**
  or moments when a force is strongest but **not directly observable**.
- Examples include:
  - perigee / perihelion,
  - moments of strongest tidal or orbital influence.

In this sense, South frequently represents:
- *hidden intensity*,
- *invisible pull*,
- or *maximum influence without maximum visibility*.

#### North (N)

- When illumination or visibility is relevant (e.g. solar or diurnal cycles), North is frequently associated with **maximum light and exposure**.
- Also North often corresponds to a state of **reduced gravitational load** or weakened binding forces within a cycle.

North thus tends to represent:
- *manifestation*,
- *clarity*,
- *peak observability*
- *freedom, openness, and dynamism*
 
North acts as a **counterbalance to the South**:
- if South marks compression and hidden intensity,
- North marks release, expansion, clarity and sustained motion.

It defines the upper limit of freedom within the cycle, preventing the system from collapsing into the maximum concentration expressed at the South, enabling circulation, movement, and connection.

#### East (E) and West (W)

- East and West are most often associated with **transitions and balance points**.
- They frequently correspond to:
  - equinoxes,
  - midpoints between opposing extremes,
  - moments of change in dominance between two regimes.

These directions tend to represent:
- *emergence* and *initiation* (East),
- *completion*, *release*, or *handover* (West),
  without being absolute maxima or minima themselves.

Within ChronoCompass, **East is the canonical entry and exit point of every cycle**, defining its temporal origin and closure.

### Consistency Across Cycles

By carefully aligning focal points with directions:

- East, North, West, and South are not merely geometric markers,
- but **structural anchors** that carry comparable interpretative weight
  across all wheels.

Some cycles define all main directions astronomically;
others define only a subset, with remaining directions derived mathematically.
In all cases, the assignment is explicit and internally consistent.

This allows:
- different cycles to remain physically independent,
- while still forming a **coherent directional system** when viewed together.

### Meaning Through Structure

Because the same compass model is reused everywhere:

- relationships between cycles become immediately visible,
- resonance and drift can be reasoned about spatially,
- and long-term patterns emerge without additional explanation.

Meaning is not imposed through metaphor,
but **emerges from structure, repetition, and alignment**.

The compass in ChronoCompass is therefore not symbolic decoration,
but a **carefully constructed coordinate system**
that enables a shared logic of time across scientific,
educational, and interpretative domains.

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

Collections are an **analytical tool**, not just an interface convenience.

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

- Accuracy above all else.
- Visual intuition over raw tables.
- Explicit structure over hidden assumptions.
- Independence of cycles over artificial harmony.

ChronoCompass treats time not as a line, but as a **system of interacting cycles**.