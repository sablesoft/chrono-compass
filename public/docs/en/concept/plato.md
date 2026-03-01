# Plato Wheel

Plato Wheel is a Wheel type that describes a **deep-time axial precession cycle**.

In the current implementation, it is a compatibility wheel backed by a legacy precession solver.

It is not a horizon model, not a synodic phase-angle wheel, and not a distance wheel.

---

## What question does it answer?

For a given timestamp `t`:

* Where is Earth inside the current precession cycle?
* What are the current cycle anchors `E, N, W, S, E+`?
* How is `t` positioned inside the cycle frame `E .. E+`?

In short:

> Where are we in the current Platonic (precessional) cycle?

---

## Current scope in `math/plato.ts`

The current Plato solver is intentionally strict:

* Allowed roles: `looker=ref:galactic-center`, `target=Earth`
* Any other role combination returns an `invalid roles` error.

This is a deliberate compatibility stage.

---

## Core concept

Plato Wheel uses a long precessional cycle of Earth’s axis.

Legacy anchors are defined as:

* **E**      — formal cycle start
* **N**      — quarter phase
* **W**      — half phase
* **S**      — south-shifted alignment sector in the model
* **E+**     — cycle end / next cycle start

Canonical order:

E → N → W → S → E+

---

## Solver source and behavior

`math/plato.ts` delegates anchor generation to legacy:

* `deprecated/plato.ts`

Then it converts the returned anchors into unified 17-spoke cycle output.

---

## Spoke construction (17 spokes)

Plato Wheel returns:

* 0: `E`
* 4: `N`
* 8: `W`
* 12: `S`
* 16: `E_next`

Intermediate spokes are built by quarter interpolation between anchors via shared spoke grammar.

---

## Tags

Current solver tags:

* `E-plato`, `N-plato`, `W-plato`, `S-plato` (except `E_next`)
* `cycle start`, `cycle end` on `E`

No additional plato-specific meta fields are attached in `math/plato.ts` at this stage.

---

## Example

`Galactic Plato: Earth`

* looker: `ref:galactic-center`
* target: `Earth`

This is the only valid Plato Wheel combination in the current implementation.

---

## What Plato Wheel is not

Plato Wheel is not:

* a local horizon visibility cycle (Horizon)
* a looker-focus-target angle cycle (Synod)
* a focus-target distance cycle (Bind)

It is a **deep-time precessional orientation wheel**.

---

## Implementation note

This wheel currently acts as a compatibility adapter.
Future versions may expand role support and move to a fully unified native solver.

