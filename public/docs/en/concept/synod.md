# Synod Wheel

Synod Wheel is a Wheel type that describes **angular phase cycles** between a target and a focus as seen from a looker.

It models how the relative longitude in a chosen reference plane (by default, the ecliptic plane) between the directions (looker→target and looker→focus) evolves over time.

Synod Wheel is not about distance, visibility, or altitude.
It is about **phase as structure**.

---

## What question does it answer?

For a given timestamp `t`:

* What is the current **phase angle** between target and focus from the looker?
* Is the phase progressing “forward” or “backward” (CCW vs CW) near `t`?
* Where within the current synodic cycle does `t` lie?
* When will the system hit the next key phase angles (the spokes)?

Synod Wheel answers a geometric relation question:

> How does the *relative angle* between two bodies (or a body and a reference direction) unfold over time for this observer?

---

## Core concept

A Synod Wheel represents a **phase cycle** of the form:

* `φ(t) = norm360( λ_target(t) − λ_focus(t) )`

Where:

* `λ_target(t)` is the ecliptic longitude of the direction from **looker → target**
* `λ_focus(t)` is the ecliptic longitude of the direction from **looker → focus**

The phase is defined on a fixed plane (the ecliptic), so the wheel is consistent across time.

Synod cycles can be regular (e.g. lunar synodic month) or irregular (e.g. if the focus is a fixed inertial reference).

---

## Direction and “forward phase”

Raw phase `φ(t)` can appear to increase or decrease near `t` depending on the relative motion.

Synod Wheel normalizes this by defining a **forward phase** `θ(t)` that always increases with time (mod 360):

* If motion is **CCW**: `θ = φ`
* If motion is **CW**:  `θ = 360 − φ`

All spokes are expressed in **θ-space**.

This makes the wheel stable and comparable even when the raw phase is “running backwards”.

---

## Cycle boundaries

In Chrono Compass, all cyclic Wheels begin at **E**.

For Synod Wheel, `E` is defined as a specific phase boundary:

* **E**      — nearest crossing of `θ = 90°` at or before `t`
* **E+**     — nearest crossing of `θ = 90°` after `t`

This creates the canonical cycle frame:

E → N → W → S → E+

Where, by design:

* **E**  corresponds to `θ = 90°`
* **N**  corresponds to `θ = 180°`
* **W**  corresponds to `θ = 270°`
* **S**  corresponds to `θ = 360°` (≡ 0°)
* **E+** corresponds to `θ = 450°` (the next 90° boundary)

The cycle length is not assumed constant.
It is discovered dynamically from the two neighboring 90° crossings.

---

## Entities and required attributes

Synod Wheel requires three roles:

* **looker** — the observer body that defines the perspective frame
* **focus**  — the reference direction/body that defines phase zero
* **target** — the body whose phase relative to focus is tracked

Notes:

* `focus` may be an **engine body** (Sun, planets, Moon…) or a **reference** (fixed inertial direction from the catalog).
* No horizon. No local observer point. This is not a topocentric visibility model.

---

## Examples

`Earth Synod: Sun → Moon`

* looker: Earth
* focus: Sun
* target: Moon

This is the classic **lunar synodic cycle** (New/Quarter/Full/Quarter/New), but expressed with `E` anchored at `θ = 90°` by convention.

`Sun Synod: ref:galactic-center → Earth`

* looker: Sun
* focus: a fixed inertial reference direction
* target: Earth

This produces an Earth phase cycle relative to a non-orbital inertial direction.
The period is not assumed and is solved from actual crossings.

`Mars Synod: Sun → Phobos`

Conceptually valid if the engine supports those bodies.

---

## What Synod Wheel is not

Synod Wheel is not:

* a distance cycle (Bind / Range)
* a horizon visibility cycle (Horizon)
* a directional snapshot (Compass)
* an illumination model by itself

Synod Wheel does not measure brightness or altitude.
It measures **relative angle on the ecliptic**.

---

## Geometry mapping

Synod Wheel maps **phase angle to time**.

### Phase axis

Let:

* `θ(t)` be the forward phase in `[0..360)`

The solver constructs a cycle by locating two consecutive crossings of `θ = 90°`:

* `E`  is the last `θ=90°` crossing at/before `t`
* `E+` is the next `θ=90°` crossing after `t`

Inside this interval, define an **unwrapped** phase:

* `Θ(t) ∈ [90..450)` such that:

    * `Θ(E)   = 90`
    * `Θ(E+) ≈ 450`

This unwrapped phase is time-ordered and single-valued within the cycle.

---

## Phase structure (17 spokes)

The Synod Wheel divides the cycle `[E .. E+]` into 16 equal **phase-angle** segments plus a closing boundary.

Indices:

0  : E    (Θ = 90)
4  : N    (Θ = 180)
8  : W    (Θ = 270)
12 : S    (Θ = 360)
16 : E+   (Θ = 450)

Intermediate spokes target the exact angles:

* `Θ_i = 90 + 360 * i / 16` for `i = 0..16`

For each `Θ_i`, the solver finds the timestamp `t_i` such that:

* `Θ(t_i) = Θ_i` within `[E, E+]`

This means the spokes are evenly distributed in **phase progression**, not time progression.

---

## Mathematical properties

Synod Wheel relies on these practical guarantees within a single cycle window:

* Motion direction near `t` can be detected (CCW or CW for raw phase).
* With direction normalized, forward phase `θ(t)` progresses consistently.
* Between two consecutive `θ=90°` crossings, the unwrapped phase `Θ(t)` is well-defined.
* Root finding (bisection) on `Θ(t) − Θ_i` is deterministic when the endpoints bracket.

The result is a robust cycle structure without assuming a fixed synodic period.
