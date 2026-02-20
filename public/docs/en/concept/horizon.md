# Horizon Wheel

Horizon Wheel is a Wheel type that describes the **visibility cycle** of a single target body relative to a **local horizon**.

Unlike Compass Wheel (a spatial snapshot), Horizon Wheel is **time-first**: its structure is defined by **rising and setting** (horizon crossings) and by the target’s vertical motion between them.

In Chrono Compass terms, it answers one specific question:

> How does this target move through visibility (above/below the horizon) for this observer, and where are the key turning points in the current cycle?

---

## What question does it answer?

At a selected timestamp `t` for a given local observer:

* When was the **last rising** before `t`?
* When is the **next rising** after `t`?
* When is the **setting** between those two risings?
* When does the target reach its **highest altitude** while visible?
* When does it reach its **lowest altitude** while invisible?
* Where does `t` lie within the resulting visibility cycle?

In short:

> What is the current “day–night” cycle of this target in the local sky, and what are its anchors?

---

## Core concept

A Horizon Wheel is a **topocentric** (local) cycle built around **horizon crossings** where the target’s geometric center satisfies:

* **altitude(center) = 0°**

Refraction is intentionally **disabled**. This is a *geometric* horizon model.

The cycle frame is defined by neighboring risings around `t`:

* **E**      — last rising at or before `t` (alt crosses 0 from − to +)
* **E_next** — next rising after `t` such that `E ≤ t < E_next`
* **W**      — first setting between `E` and `E_next` (alt crosses 0 from + to −)
* **N**      — maximum altitude on `[E, W]` (visible half)
* **S**      — minimum altitude on `[W, E_next]` (invisible half)

This yields the canonical cycle structure:

E → N → W → S → E_next

Where the two halves have natural meaning:

* `E..W` is the **visible arc** (above horizon)
* `W..E_next` is the **invisible arc** (below horizon)

---

## Entities and required attributes

Horizon Wheel depends on a local horizon, so it requires a surface location.

Required attributes:

* **looker** — the body whose horizon frame is used
* **observer** — a local point on the looker (latitude, longitude, height)
* **target** — the body whose visibility cycle is modeled

Notes:

* Horizon Wheel exists only if the target **actually crosses** the horizon for the chosen observer.
* Circumpolar or never-rising targets do not have a valid Horizon Wheel at that location.

---

## Cycle structure in Chrono Compass grammar

Chrono Compass cyclic Wheels use a shared 4-anchor grammar and 17 spokes:

* 0  : **E**      (rising)
* 4  : **N**      (max altitude while visible)
* 8  : **W**      (setting)
* 12 : **S**      (min altitude while invisible)
* 16 : **E+**     (next rising boundary)

Other 12 spokes are created by **time-linear interpolation** inside each quarter.

**TODO**: change to alt-linear interpolation inside each quarter.

---

## What the spokes contain (meta)

Each spoke is a timestamped sample of the target’s local sky state.

Typical meta values:

* **altitudeDeg** — topocentric altitude (−90..+90)
* **azimuthDeg** — topocentric azimuth (0..360)
* **raHours**, **decDeg** — equatorial coordinates (optional for UI/diagnostics)
* **distanceAu**, **distanceKm** — distance to target (optional)

This lets the UI render both:

* the cycle structure (spokes / houses), and
* the physical state at each spoke.

---

## Crossing definition and edge cases

Horizon Wheel uses a strict definition of crossings:

* Rising is a **sign change** through 0° from negative to positive.
* Setting is a **sign change** through 0° from positive to negative.

“Grazing” events (touching 0° without a sign change) are intentionally ignored.

Near pathological regions (very high latitudes, rare crossings), the solver may need to search many days forward/backward to find the neighboring risings that frame `t`.

To avoid degenerate cycles, extremely short visible or invisible phases (near-grazing) are treated as unstable and the solver can locally “bump” the evaluation time to recover a usable frame.

---

## Relationship to Compass Wheel

Horizon Wheel and Compass Wheel both use the local horizon frame, but they answer different questions.

* **Compass Wheel**: “Where are many targets around me *right now*?” (space-first)
* **Horizon Wheel**: “How does one target move through *visibility over time*?” (time-first)

Compass never hides targets and does not require crossings.
Horizon requires real crossings and uses them as the primary structural anchors.

---

## Practical examples

`Earth Horizon: Sun`

* E: sunrise
* N: upper culmination (highest altitude while visible)
* W: sunset
* S: lower culmination (lowest altitude while invisible)
* E_next: next sunrise

`Earth Horizon: Moon`

Same structure, but the cycle is irregular in length and shape depending on lunar motion.

`Mars Horizon: Phobos`

Would be conceptually valid (looker = Mars), but actual implementation may restrict supported lookers.

---

## What Horizon Wheel is not

Horizon Wheel is not:

* a distance cycle (Bind)
* an alignment cycle (Synod / Channel)
* a directional snapshot (Compass)

It is a **visibility and vertical-motion cycle** anchored in horizon crossings for a concrete observer.
