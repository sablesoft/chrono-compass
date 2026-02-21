# Synod Wheel

Synod Wheel is a Wheel type that describes **angular phase cycles** defined at a geometric vertex.

It models how the angle at a **focus** body between the directions toward a **looker** and a **target** evolves over time.

Synod Wheel is not about distance, visibility, or altitude.
It is about **phase as geometric structure**.

---

## What question does it answer?

For a given timestamp `t`:

* What is the current **phase angle** at the focus between looker and target?
* Is the phase progressing “forward” or “backward” (CCW vs CW) near `t`?
* Where within the current synodic cycle does `t` lie?
* When will the system hit the next key phase angles (the spokes)?

Synod Wheel answers a geometric relation question:

> How does the *angle at the focus* between looker and target unfold over time?

---

## Core concept

A Synod Wheel represents a **phase cycle** of the form:

* `φ(t) = norm360( λ_target(t) − λ_looker(t) )`

Where:

* `λ_target(t)` is the ecliptic longitude of the direction **focus → target**
* `λ_looker(t)` is the ecliptic longitude of the direction **focus → looker**

The phase is defined on a fixed reference plane (by default, the ecliptic), so the wheel is consistent across time.

Synod cycles may be regular (e.g. orbital phase relations) or irregular (e.g. when the looker is an inertial reference direction).

---

## Geometry

The geometry is defined strictly at the vertex:

* **focus** — the vertex of the angle and geometric center of the Wheel
* **looker** — defines the reference direction (S)
* **target** — rotates around the focus relative to the looker

Configurations:

* **S** — focus–target–looker  (φ ≈ 0°)
* **N** — target–focus–looker  (φ ≈ 180°)

The angle is always measured in the plane projection of the directions from focus.

---

## Direction and “forward phase”

Raw phase `φ(t)` can increase or decrease near `t` depending on the relative motion.

Synod Wheel normalizes this by defining a **forward phase** `θ(t)` that always increases with time (mod 360):

* If motion is **CCW**: `θ = φ`
* If motion is **CW**:  `θ = 360 − φ`

All spokes are expressed in **θ-space**.

This makes the wheel stable and comparable even when the raw phase locally decreases.

---

## Cycle boundaries

In Chrono Compass, all cyclic Wheels begin at **E**.

For Synod Wheel:

* **E**      — nearest crossing of `θ = 90°` at or before `t`
* **E+**     — nearest crossing of `θ = 90°` after `t`

This creates the canonical cycle frame:

E → N → W → S → E+

By design:

* **E**  corresponds to `θ = 90°`
* **N**  corresponds to `θ = 180°`
* **W**  corresponds to `θ = 270°`
* **S**  corresponds to `θ = 360°` (≡ 0°)
* **E+** corresponds to `θ = 450°`

The cycle length is not assumed constant.
It is discovered dynamically from the two neighboring 90° crossings.

---

## Entities and required attributes

Synod Wheel requires three roles:

* **looker** — a Solar System body or an inertial reference direction
* **focus**  — the vertex body where the angle is defined
* **target** — the body whose phase relative to the looker is tracked

Notes:

* `focus` must be a physical engine body (it defines the vertex position).
* `looker` may be either an engine body or a reference direction.
* No horizon model. No topocentric observer. This is a pure geometric phase relation.

---

## Examples

`Sun Synod: Earth - Moon`

* looker: Sun
* focus: Earth
* target: Moon

The angle is measured at the Earth between Looker and Moon.

`Galactic Synod: Sun - Saturn`

* looker: Galactic
* focus: Sun
* target: Saturn

The angle is measured at the Sun between the Galactic Center direction and Saturn.

`Mars Synod: Jupiter - Phobos`

Conceptually valid if supported by the engine.

---

## What Synod Wheel is not

Synod Wheel is not:

* a distance cycle (Bind / Range)
* a horizon visibility cycle (Horizon)
* a directional snapshot (Compass)
* an illumination or brightness model

It measures **relative angular structure on a fixed plane**.

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

Intermediate spokes target exact angles:

* `Θ_i = 90 + 360 * i / 16` for `i = 0..16`

For each `Θ_i`, the solver finds the timestamp `t_i` such that:

* `Θ(t_i) = Θ_i` within `[E, E+]`

Spokes are evenly distributed in **phase progression**, not time progression.

---

## Mathematical properties

Within a single cycle window:

* Motion direction near `t` can be detected (CCW or CW for raw phase).
* After normalization, forward phase `θ(t)` progresses consistently.
* Between two consecutive `θ=90°` crossings, the unwrapped phase `Θ(t)` is well-defined.
* Root finding (bisection) on `Θ(t) − Θ_i` is deterministic when the endpoints bracket.

The result is a robust cycle structure without assuming a fixed synodic period.
