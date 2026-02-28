# System Wheel

System Wheel is a Wheel type that describes a **multi-body orbital system view** in a shared compass-like frame.

It uses the same visual grammar as Compass Wheel, but its semantics are not topocentric horizon-based.
Instead, it combines:

* **synodic phase geometry** (angular position around the wheel),
* **distance geometry** (radial position),
* **ecliptic latitude sign** (north/south relative to the ecliptic plane).

System Wheel is not about local visibility.
It is about **system structure around a selected focus**.

---

## What question does it answer?

At a selected timestamp `t` and for a selected frame (`looker`, `focus`):

* Where is each target in phase around the system right now?
* Which targets are north/south of the ecliptic plane?
* How far is each target from the focus body?
* How does each target move along its current system orbit segment?

In short:

> What does this orbital system look like right now in one coherent frame?

---

## Core concept

System Wheel is a **composite wheel** built from several cycle engines.

For each target:

* angle is derived from synodic phase (`synod` geometry),
* base orbit samples come from the current synod cycle spokes,
* extra shaping points come from one or more `bind` cycles in the same time window,
* style transition points are added where motion crosses the ecliptic plane.

This gives a stable, comparable orbit track that can be rendered in one shared wheel for many targets at once.

---

## Entities and required attributes

System Wheel requires three role groups:

* **looker** — reference direction source for synodic phase construction
* **focus** — central body of the displayed system
* **targets** — one or many bodies shown on the wheel

No topocentric observer location is required for system geometry itself.

---

## Geometry mapping

### Angular mapping (phase)

Each target marker angle is derived from synodic phase around the selected frame.

The wheel keeps the same compass-style orientation used in the app, so interaction remains consistent with Compass UI.

### Radial mapping (distance normalization)

Raw distances are measured in AU from **focus → target**.

To keep many targets readable in one wheel, radius is normalized by the farthest available point in the current solve set:

* collect distances from current marker states and their orbit track points,
* find `maxDistance`,
* map each point radius as `distance / maxDistance`.

As a result:

* the farthest available point maps to orbit `1`,
* all others are proportional inside that range.

### Vertical semantic channel (ecliptic latitude)

Each point also has ecliptic latitude (`Ecl`):

* `Ecl >= 0` → **north**
* `Ecl < 0`  → **south**

This sign is used for style splitting (solid/dashed) and tooltip semantics.

---

## Spokes, tracks, and nodes

System Wheel tracks are assembled per target in layers:

1. **Synod spokes** (primary structural nodes)
2. **Bind nodes** sampled within the current synod cycle window (shape refinement)
3. **Densification nodes** inserted when neighboring angular gap is too large
4. **Seam nodes** at ecliptic crossing points for accurate style transitions

Merge policy keeps high-priority structure deterministic:

* cycle boundary nodes (`E`, `E+`, `E_next`) stay preserved,
* seam nodes have priority over regular nodes,
* primary spokes remain preferred over nearby secondary samples.

This avoids visual ambiguity and keeps navigation anchors stable.

---

## Readout semantics in UI

System Wheel uses dedicated labels:

* **Phase** — angular phase position
* **Ecl** — ecliptic latitude in degrees
* **north / south** — sign of ecliptic latitude
* **Dist to &lt;focus&gt;** — focus-to-target distance

These are solver-provided semantics, so the Compass template can render different wheel types without hardcoded Earth/horizon assumptions.

---

## Interaction model

System Wheel uses the Compass-style interaction shell:

* hover/click markers and clusters,
* pin a target,
* inspect orbit nodes,
* jump to node moments,
* double-click supported nodes/spokes for time navigation.

When a target is pinned, spoke navigation resolves to that target’s corresponding orbit nodes in the current cycle context.

---

## How System differs from Compass Wheel

**Compass Wheel** is topocentric and observer-local:

* angle = azimuth
* radius = altitude (inside/outside horizon ring)
* semantics = above/below horizon

**System Wheel** is system-geometric:

* angle = synodic phase mapping
* radius = normalized focus distance
* semantics = north/south of ecliptic

Compass answers “where in my local sky?”
System answers “where in this orbital system frame?”

---

## Practical examples

`Galactic System: Sun - Mercury`

* looker: Galactic Center direction
* focus: Sun
* targets: planets
* output: comparative phase-distance map of the planetary system around Sun

`Sun System: Earth - Moon`

* looker: Sun
* focus: Earth
* target: Moon
* output: Earth-centered system snapshot driven by synod+bind geometry

---

## What System Wheel is not

System Wheel is not:

* a local horizon visibility wheel (Horizon/Compass semantics),
* a pure single-target synod cycle view,
* a pure distance-only cycle.

It is a **composed multi-target system representation** that reuses cycle engines to build a unified orbital map.
