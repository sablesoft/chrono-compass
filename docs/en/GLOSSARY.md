# ChronoCompass — Glossary

This glossary defines the core terms used throughout the ChronoCompass project.  
Terms are intentionally concise and precise to support both technical and conceptual understanding.

---

## Wheel

A **wheel** is a circular representation of a single cyclical system.

Each wheel:
- represents one independent cycle of time,
- has its own duration, anchors, and physical meaning,
- is visualized using a unified compass-based model.

Examples:
- Diurnal wheel (Earth rotation),
- Lunar Synodic wheel (Moon phases),
- Solar Tropical wheel (seasons),
- Platonic wheel (axial precession).

---

## Cycle

A **cycle** is a repeating temporal process with a defined structure.

In ChronoCompass:
- cycles are not forced to synchronize,
- cycles may drift relative to each other,
- the interaction between cycles is considered meaningful.

A cycle is the physical or astronomical phenomenon;  
a wheel is its visual and analytical representation.

---

## Direction (Spoke)

A **direction** is a radial axis of a wheel.

Each wheel contains **16 directions**, corresponding to compass points:
- Main directions: **E, N, W, S**
- Intermediate directions: ENE, NE, NNE, etc.

Directions:
- represent focal moments or reference points in a cycle,
- are used to position events in time,
- act as anchors for interpretation and comparison.

---

## Main Directions (E / N / W / S)

The four **main directions** are the primary structural anchors of a wheel.

Depending on the cycle:
- all four may be astronomically defined,
- or only some are astronomically computed, while others are derived mathematically.

They carry consistent structural meaning across all cycles.

---

## House

A **house** is a temporal sector of a wheel.

- Each wheel is divided into **16 houses**.
- A house is centered on a direction (spoke).
- House boundaries lie halfway between neighboring directions.

Important:
- houses are **not always equal in duration**,
- their length depends on the nature of the cycle.

Example:
- in the diurnal cycle, daytime and nighttime houses differ in length.

---

## House Boundaries

**House boundaries** are the temporal transitions between houses.

They:
- define changes in dominance between neighboring directions,
- are critical for detecting transitions, thresholds, and edge cases,
- often play a role in eclipse logic and resonance analysis.

---

## Anchor

An **anchor** is a key timestamp used to define a wheel’s structure.

Anchors typically correspond to:
- astronomical events (equinoxes, solstices, perigee, apogee),
- or derived midpoints between such events.

Anchors define:
- direction positions,
- house boundaries,
- cycle start and end points.

---

## Focal Point

A **focal point** is a moment of maximum or minimum expression of a cycle’s property.

Examples:
- maximum illumination,
- minimum or maximum distance,
- peak gravitational influence.

Focal points are usually mapped to main directions.

---

## Moment

A **moment** is a specific point in time stored by the user.

Moments can be:
- absolute (single timestamp),
- periodic (recurring with a defined period).

Each moment may include:
- a name,
- a description,
- metadata.

---

## Periodic Moment

A **periodic moment** is a repeating event.

Examples:
- birthdays,
- anniversaries,
- monthly or yearly events,
- custom-defined cycles.

Periodic moments are projected onto wheels based on their period.

---

## Collection

A **collection** is a group of moments.

Collections allow:
- organizing events by theme or purpose,
- enabling or disabling visibility,
- assigning moments to different orbital radii,
- comparing multiple datasets across cycles.

Collections are a core analytical feature.

---

## Orbital Radius

An **orbital radius** defines how far from the center of a wheel a moment or collection is displayed.

It is:
- purely a visual and analytical dimension,
- used to separate datasets,
- useful for comparing layers of information.

---

## Resonance

**Resonance** describes meaningful alignment or interaction between cycles.

Resonance does not imply exact synchronization.  
It may involve:
- repeated near-alignments,
- slow drifting patterns,
- long-term interference rhythms.

---

## Drift

**Drift** is the gradual change in relative alignment between independent cycles.

Drift is:
- expected,
- intentional,
- informative.

It reveals long-term structures and rhythms that cannot be seen in a single cycle.

---

## Tropical Cycle

A **tropical cycle** is defined relative to Earth’s seasons and equinoxes.

Example:
- Solar Tropical Year.

It is tied to:
- Earth’s axial tilt,
- the Sun–Earth geometry,
- climate and seasonal variation.

---

## Anomalistic Cycle

An **anomalistic cycle** is defined by distance extremes.

Examples:
- lunar anomalistic month (perigee to perigee),
- solar anomalistic year (perihelion to perihelion).

It reflects variations in gravitational influence.

---

## Draconic Cycle

A **draconic cycle** is defined by orbital nodes.

Example:
- lunar draconic month.

It is essential for:
- eclipse prediction,
- understanding orbital inclination effects.

---

## Diurnal Cycle

The **diurnal cycle** represents Earth’s rotation relative to the Sun.

It defines:
- day and night,
- local solar time,
- illumination patterns.

Its structure varies by latitude.

---

## Platonic (Precessional) Cycle

The **Platonic cycle** represents axial precession of Earth.

- Duration: ~25,772 years.
- Often called the *Platonic Year*.

It describes how Earth’s rotational axis slowly changes orientation in space.

---

## Unified Compass Model

The **Unified Compass Model** is the foundational visualization framework of ChronoCompass.

It:
- maps diverse cycles onto a common compass structure,
- assigns consistent meaning to directions across cycles,
- allows intuitive comparison of unrelated temporal systems.

This model is intentionally simple, logical, and extensible.

---

## Offline-First

**Offline-first** means the application:
- functions fully without internet access,
- performs all calculations locally,
- stores data on the device.

Connectivity is optional and limited to updates and location detection.

---

## PWA (Progressive Web App)

ChronoCompass can be installed as a **Progressive Web App**.

This allows:
- home screen installation,
- offline usage,
- near-native behavior on mobile and desktop devices.

---

## Interpretation Layer

An **interpretation layer** refers to how users choose to understand the data.

ChronoCompass:
- provides structure and accuracy,
- does not enforce interpretation,
- supports scientific, educational, symbolic, and philosophical use equally.
