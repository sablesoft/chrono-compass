# Season Wheel

Season Wheel is a Wheel type that describes a **seasonal cycle** as a structured orbital-year frame.

In the current implementation, it is a compatibility wheel backed by a legacy tropical solver.

It is not a horizon model, not a synodic angle model, and not a distance model.

---

## What question does it answer?

For a given timestamp `t`:

* Which part of the tropical year is currently active?
* Where are the nearest cardinal seasonal anchors around `t`?
* How is `t` positioned inside the current seasonal cycle `E .. E+`?

In short:

> Where are we inside the current tropical seasonal cycle?

---

## Current scope in `math/season.ts`

The current Season solver is intentionally strict and minimal:

* Allowed roles: `focus=Sun`, `target=Earth`
* Any other role combination returns an `invalid roles` error.

This is by design for the current migration phase.

---

## Core concept

Season Wheel is built from tropical-year anchor events using cosmopolitan terms:

* **E**      — East Equinox (cycle start)
* **N**      — North Solstice
* **W**      — West Equinox
* **S**      — South Solstice
* **E+**     — next East Equinox

Canonical order:

E → N → W → S → E+

These anchors define one full seasonal cycle.

Meaning of key terms:

* **North Solstice**: the target north axis is maximally directed toward the focus.
  This is the maximum solar-activity/insolation side for the target north hemisphere.
* **South Solstice**: the target north axis is maximally directed away from the focus.
  This is the maximum solar-activity/insolation side for the target south hemisphere.
* **East Equinox / West Equinox (E/W)**: neutral crossings where the target north axis is neither directed toward nor away from the focus.

For Earth-focused language, `North Solstice` corresponds to the June solstice and `South Solstice` to the December solstice.

---

## Solver source and behavior

`math/season.ts` delegates anchor calculation to legacy:

* `deprecated/solarTropical.ts`

The legacy solver provides tropical anchors.
Then `math/season.ts` converts anchors into unified 17-spoke cycle output.

---

## Spoke construction (17 spokes)

Season Wheel returns:

* 0: `E`
* 4: `N`
* 8: `W`
* 12: `S`
* 16: `E_next`

Intermediate spokes are built by quarter interpolation between anchors, following the shared wheel spoke grammar.

---

## Tags

Current solver tags:

* `E-season`, `N-season`, `W-season`, `S-season` (except `E_next`)
* `cycle start`, `cycle end` on `E`

No additional season-specific meta fields are currently attached in `math/season.ts`.

---

## Example

`Sun Season: Earth`

* focus: Sun
* target: Earth

This is the only valid Season Wheel combination in the current implementation.
The terminology above remains universal and not Earth-bound.

---

## What Season Wheel is not

Season Wheel is not:

* a local observer horizon cycle (Horizon)
* a looker-focus-target angle cycle (Synod)
* a focus-target distance cycle (Bind)

It is a **seasonal tropical-year structure wheel**.

---

## Implementation note

This wheel is currently a compatibility adapter.
Future versions may expand role support and switch to a fully unified native solver.
