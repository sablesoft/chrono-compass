# Bind Wheel

Bind Wheel is a Wheel type that describes **orbital distance cycles** between a target body and its focus body.

It models how the physical separation between two gravitationally bound bodies expands and contracts over time.

Bind Wheel is not about angle, visibility, or alignment.
It is about **distance as structure**.

---

## What question does it answer?

For a given timestamp `t`:

* How far is the target from its focus right now?
* Is the target moving toward periapsis (minimum distance) or apoapsis (maximum distance)?
* Where within its anomalistic cycle does the target currently lie?
* When will it reach the next minimum or maximum distance?

Bind Wheel answers a purely geometric question:

> How does orbital binding breathe over time?

---

## Core concept

A Bind Wheel represents the **anomalistic distance cycle** of a target orbiting its focus.

Every stable bound orbit has:

* one minimum distance (periapsis)
* one maximum distance (apoapsis)
* continuous motion between them

In Chrono Compass, **all cyclic Wheels begin at E**.

E is the structural zero-point of every cycle —  
the mid-distance boundary where one cycle ends and the next begins.

This creates a closed cyclic structure:

E → N → W → S → E → N → ...

Where:

* **E** — mid-distance boundary (cycle start)
* **N** — maximum distance (apoapsis)
* **W** — mid-distance on the decreasing branch
* **S** — minimum distance (periapsis)
* **E+** — next mid-distance boundary (start of the next cycle)

The cycle is defined strictly by distance geometry, not by calendar dates.

---

## Role inside Chrono Compass

Bind Wheel provides the **radial skeleton** of orbital systems.

It reveals:

* orbital eccentricity
* expansion/contraction rhythm
* structural asymmetry of motion

While other Wheels describe angle, visibility, or alignment,
Bind Wheel anchors the system in **pure orbital geometry**.

It answers the most fundamental orbital question:

> How tightly is the target bound right now?

---

## Entities and required attributes

* **focus** — the central body that gravitationally binds the target
* **target** — the orbiting body whose distance is tracked

No looker.
No observer.
No horizon.

Bind Wheel exists purely in orbital space.

---

## Examples

`Sun Bind: Earth`
(focus: Sun, target: Earth)

Represents Earth’s anomalistic year (perihelion → aphelion → perihelion).

`Earth Bind: Moon`
(focus: Earth, target: Moon)

Represents the lunar anomalistic cycle (~27.55 days).

`Sun Bind: Pluto`
(focus: Sun, target: Pluto)

Represents a highly eccentric long-period orbital cycle.

---

## What Bind Wheel is not

Bind Wheel is not:

* a synodic cycle
* a visibility cycle
* a directional orientation model
* a seasonal tilt model

It does not describe angle.
It does not describe alignment.
It does not describe illumination.

It describes **orbital breathing**.

---

## Geometry mapping

Bind Wheel maps **distance to angular phase**.

### Distance axis

Let:

* r(t) be the distance between target and focus
* r_min be the minimum distance in the current cycle
* r_max be the maximum distance in the current cycle

Distance changes monotonically between extrema:

* from r_min to r_max (expansion)
* from r_max to r_min (contraction)

This guarantees a well-defined cyclic mapping.

---

### Phase structure (17 spokes)

The Bind Wheel divides one full distance cycle into 16 equal relational segments plus a closing boundary.

Indices:

0  : E
4  : N
8  : W
12 : S
16 : E+

Segments:

* 0 → 4   : increasing branch (mid → max)
* 4 → 12  : decreasing branch (max → min)
* 12 → 16 : increasing branch (min → mid)

The cycle is continuous and strictly ordered in time.

---

## Cycle structure

Each cycle is defined by two neighboring extrema:

* one minimum (S)
* one maximum (N)

Between them, distance behaves monotonically.

The cycle boundary (E) is defined as the midpoint distance between:

* previous minimum and maximum

The next boundary (E+) is defined between:

* current minimum and next maximum

This creates a structurally stable cyclic window:

S_before < N < S < N_next

Bind Wheel is constructed entirely from this ordering.

---

## Mathematical properties

Bind Wheel relies on fundamental orbital properties:

* Orbital motion is continuous.
* Distance extrema alternate strictly (min → max → min → max …).
* Between extrema, the distance function is monotonic.
* Within a sufficiently small window (less than half a cycle), there is at most one extremum.

These properties guarantee deterministic cycle construction.

