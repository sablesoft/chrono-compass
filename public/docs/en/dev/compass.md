# Compass Technical Specification

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
