# Compass Wheel

Compass Wheel (also called **Rose Wheel**) is a Wheel type that describes **spatial orientation** around a local observer at a given moment.

It is intentionally designed as a **navigation instrument** for the entire Chrono Compass system: a shared spatial frame that connects multiple targets and serves as an entry point for exploring and switching between other Wheels associated with those targets.

Compass Wheels describe **spatial orientation**, not phase transitions.

---

## Wheel Types snippet (for cross-reference)

### Compass Wheels

Directional orientation structures describing the azimuthal position of one or multiple target bodies around a looker body at a given moment.

Compass Wheels (or Rose Wheels) describe **spatial orientation**, not phase transitions.

Compass Wheel is a **root type**, intentionally designed and organized as a **navigation instrument** for the entire Chrono Compass system.
They provide a shared spatial frame that connects multiple targets and serve as an entry point for exploring and switching between other Wheels associated with those targets.

**Required attributes:**

* looker
* target (one or many)
* observer

Compass Wheels do **not** require horizon crossings and are valid for any celestial bodies, for example:

* circumpolar bodies,
* the bodies always above or below the horizon,
* stars and planets alike.

*Examples:*
`Earth Compass: Sky`
(looker: Earth, targets: multiple, observer: Earth surface point)

`Mars Compass: Phobos`
(looker: Mars, target: Phobos, observer: Mars surface point)

`Jupiter Compass: Satellites`
(looker: Jupiter, targets: multiple, observer: Jupiter reference frame point)

---

## What question does it answer?

At a selected timestamp `t` and for a given local observer:

* Where (azimuth) is each selected target around the observer right now?
* How high above the horizon is it (altitude)?
* If a target is fixed: when (past/future) will it reach a chosen direction (spoke or house boundary)?

Compass Wheel is not about “phases” or “transitions”. It is a spatial snapshot plus conditional navigation.

---

## Core concept

A Compass Wheel represents the **local horizon circle** around an observer on (or near) the surface of a looker body.

* Angle encodes **azimuth** (direction around the horizon).
* Radius encodes **altitude** (height above the horizon).

Nothing “disappears”. Targets can be visible or invisible at a given time, but they remain represented.

---

## Entities and required attributes

* **looker**: the central reference body whose local sky/horizon frame is used (Earth, Mars, etc.).
* **observer**: a concrete location tied to the looker that defines the local horizon frame (e.g., a surface point).
* **targets**: one or many bodies rendered as markers (Moon, planets, satellites, stars, etc.).

---

## Geometry mapping

### Angular mapping (azimuth)

Each target marker’s angle equals its **azimuth** in the observer’s local horizon frame at time `t`.

The compass has a fixed orientation consistent with the rest of Chrono Compass (e.g., North up, East right).

### Radial mapping (altitude)

Each target marker’s radius equals its **altitude** above the horizon.

A simple intuitive mapping:

* inner horizon circle corresponds to altitude `0°`
* center corresponds to altitude `+90°` (zenith)

### Visible vs invisible targets

To keep the “full situation” always readable, the horizon circle is drawn **slightly inward**, leaving an **outer ring**.

* targets with altitude `>= 0°` (visible) are placed inside the horizon circle
* targets with altitude `< 0°` (below horizon) are placed in the outer ring at the same azimuth

This preserves directional truth while never hiding targets.

---

## Sky poles sanity (world poles)

The “world poles” should not be a UI special-case. They behave like any other target in the local horizon frame.

A correctness sanity check:

* At latitude `φ`:

    * the elevated pole appears at altitude `|φ|` at azimuth **North** (north hemisphere) or **South** (south hemisphere)
    * the opposite pole is below the horizon (outer ring)
* At the equator (`φ = 0°`):

    * both poles lie on the horizon at North and South

---

## UI role in the app

Compass Wheel is designed to look like other Wheels (same “Wheel grammar”), but uses a dedicated template and interaction model.

Key properties:

* There is **at most one Compass Wheel** in the UI at a time (visible or hidden).
* It is a **control center**: it contains the observer picker and target selection inside itself.

---

## Embedded controls inside Compass Wheel

### Looker & observer picker

Inside the compass panel:

* Show current **looker** (clickable).
* Clicking opens a modal/popup:

    * list of available lookers
    * list of saved locations for the current looker
    * switching looker updates the location list immediately
    * if there are no saved locations, choose a reasonable default location for that looker

This is essentially the same widget as the app header location picker, embedded into the compass because compass is the navigation hub.

### Target selection

Inside the compass panel:

* Show selected targets summary:

    * if 1 target: show name
    * else: show count
* Clicking opens a modal/popup:

    * searchable list with checkboxes
    * favorites section
    * toggle favorite action

---

## Markers and grouping

Targets render as markers with:

* symbol/icon
* correct azimuth angle
* correct radius (inner disk vs outer ring)
* visible/invisible styling
* fixed styling (when fixed)

When markers overlap or are too close:

* replace with a group marker displaying count
* clicking the group marker shows the list of contained targets
* selecting a target switches the info popup to that target

---

## Interaction model

### Clicking empty space

Clicking empty wheel space does **nothing**.

### Clicking a target marker

Single click:

* opens a target info popup (details defined elsewhere)

Double click / dedicated action:

* toggles **fixation** for that target
* only one target can be fixed at a time
* fixing a new target clears the previous one

Fixed target is also displayed in the compass panel.

---

## Navigation mode (fixed target)

When a target is fixed:

* spokes and house boundaries become interactive
* forward/back controls become available

### Clicking a spoke / boundary

Clicking a spoke/boundary means:

> find when the fixed target will be at this azimuth

Because the same azimuth can occur both in the past and future, clicking should produce a small choice UI:

* nearest past solution
* nearest future solution

The user selects which one to navigate to.

### Forward / back buttons

Forward/back navigation is defined in the compass semantics:

* move to the next/previous time the fixed target returns to the **same azimuth degree** as “now”
* altitude is allowed to change (it is not the invariant)

---

## How Compass differs from Horizon Wheel

**Horizon Wheel** is time-first: it describes the cyclic visibility and vertical motion of a *single* target body relative to the local horizon. It exists only when the target actually crosses the horizon; rising and setting define both its structure and meaning.
**Compass Wheel** is space-first: it describes the spatial arrangement of one or many targets around the observer at a given moment. It does not require horizon crossings and remains valid for circumpolar, always-below-horizon, and mixed visibility cases. Time is used only as a navigation parameter to find moments that satisfy directional conditions.

In short, Horizon Wheel models *how visibility evolves over time*, while Compass Wheel models *how the sky is arranged now*.

---

# TODO (Technical specification)

Everything below is implementation-facing and not required for a general reader.

## Component interface

Cyclic wheels typically:

* `<Wheel kind={kind} lat={lat} lon={lon} selectedTs={$selectedTsStore} />`

Compass wheel:

* `<Compass lat={lat} lon={lon} selectedTs={$selectedTsStore} />`

Notes:

* Compass does not use `kind`.
* `looker` is a persistent global setting, defaulting to Earth.


## A) State, persistence, and single-instance rules

* Enforce: only one Compass Wheel instance can exist at a time (visible/hidden).
* Stores to persist across sessions:

    * `looker` (default Earth)
    * saved `observer` locations per looker
    * `selectedTargets` (+ favorites)
* Runtime-only or optionally persisted:

    * `fixedTarget` (at most one)

## B) Picker integration

* Extend `locationPicker` to include `CelestialBody` selection (looker).
* When looker changes:

    * immediately switch location list to that looker’s saved locations
    * if none, use a default location for that looker
* Embed a picker UI inside the Compass Wheel panel that mirrors header picker functionality.

## C) Ephemeris / geometry output

For each target at `selectedTs` given (`looker`, `observer`):

* compute azimuth in [0..360)
* compute altitude in [-90..+90]
* determine visibility: altitude >= 0

## D) Screen mapping

* Reserve an outer ring by drawing the horizon circle slightly inward.
* Map:

    * azimuth -> marker angle
    * altitude >= 0 -> inner-disk radius (0° at horizon, +90° at center)
    * altitude < 0 -> place marker in outer ring at same azimuth

## E) Marker system

* Render markers for selected targets with symbol/icon and state styling.
* Implement collision grouping:

    * detect “too close” markers (angular + radial thresholds)
    * replace cluster with group marker (count)
    * group marker click shows list; selecting opens target popup

## F) Popups (scoped; full design later)

* Marker single click opens target popup.
* Popup includes:

    * fix/unfix action
    * related wheels toggles (add/remove from global display)

## G) Fixation

* Double click/tap toggles fixation.
* Fixing a new target clears old fixed target.
* Fixed styling on marker and in compass panel.

## H) Navigation solver: “time when azimuth == X”

Enabled only when `fixedTarget` is set.

* Spokes and boundaries are interactive only in fixation mode.
* On spoke/boundary click:

    * compute two candidate times:

        * nearest past
        * nearest future
    * show a small popup choice UI with both moments
    * on user selection: set `selectedTs` to chosen time

Define solver API:

* `findNearestTimeAtAzimuth(target, observer, desiredAzimuth, t0, direction)`

Handle edge cases:

* no solution found within window (increase window / report)
* numerical instability near stationary conditions

## I) Forward/back buttons semantics

Enabled only when `fixedTarget` is set.

* `currentAzimuth = azimuth(fixedTarget, t0)`
* forward: next time when azimuth returns to `currentAzimuth`
* back: previous time when azimuth returns to `currentAzimuth`

Altitude is not preserved.

## J) Animation plan (phased)

* MVP: instant jump to new `selectedTs` (no continuous animation).
* Later: smooth time interpolation animation updating all markers.
* Performance: caching + throttling + optional worker computation for many targets.

## K) Correctness sanity tests

* Equator: both world poles on horizon at N and S.
* Hemisphere: elevated pole altitude == |latitude| in correct direction (N or S).
* Visibility ring: altitude sign routes markers correctly.
* Navigation regression: solver yields stable nearest past/future solutions under small `t0` changes.
