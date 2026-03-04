# Nodal Wheel

Nodal Wheel is a Wheel type that describes a target body's **node cycle** relative to a reference plane.

It models when the target crosses that plane, and how far north/south of that plane it moves between crossings.

Nodal Wheel is not a horizon model and not a phase-angle model.
It is a **plane-crossing latitude cycle**.

---

## What question does it answer?

For a given timestamp `t`:

* What was the nearest previous **ascending node** crossing?
* What is the nearest next **ascending node** crossing?
* Where is the **descending node** between them?
* When does the target reach maximum north and maximum south latitude relative to the reference plane?
* Where does `t` lie inside that nodal cycle?

In short:

> How does the target move through north/south sides of a reference orbital plane?

---

## Core concept

Nodal Wheel uses nodal latitude:

* `lat_nodal(t) = asin( dot( u_target(t), n_ref(t) ) )`

Where:

* `u_target(t)` is the unit vector from the model origin to target
* `n_ref(t)` is the unit normal of the reference plane

Cycle anchors are:

* **E**      — previous ascending crossing (`lat_nodal` crosses from `-` to `+`)
* **W**      — descending crossing inside current cycle (`+` to `-`)
* **E+**     — next ascending crossing
* **N**      — maximum nodal latitude on `[E, W]`
* **S**      — minimum nodal latitude on `[W, E+]`

Canonical order:

E → N → W → S → E+

---

## Required roles

Nodal Wheel requires:

* **looker**
* **focus**
* **target**

Target must be an engine body and must differ from origin body.

---

## Supported geometric models in `nodal.ts`

Current solver supports two internal models:

### 1) Pair model (body + body)

Used when both `looker` and `focus` are engine bodies.

* Reference plane normal is built from the orbital motion of the looker-focus pair.
* The target vector is measured from the focus.

### 2) Axis model (reference axis + body)

Used when exactly one of (`looker`, `focus`) is a reference and the other is an engine body.

* Reference plane normal is taken directly from the reference axis direction.
* The target vector is measured from the anchor engine body.

If roles do not fit one of these valid combinations, solver returns a role error.

---

## Cycle boundaries

Nodal Wheel is bounded by two ascending-node crossings:

* **E** at or before `t`
* **E+** after `t`

Search strategy:

* coarse scan + bisection refinement
* exponential window expansion (large windows for slow bodies)

Then solver finds:

* **W** as first descending crossing inside `[E, E+]`
* **N** as latitude maximum on `[E, W]`
* **S** as latitude minimum on `[W, E+]`

If strict ordering fails (`E < N < W < S < E+`), solve fails.

---

## Spoke construction (17 spokes)

Nodal Wheel returns 17 spokes:

* 0: `E`
* 4: `N`
* 8: `W`
* 12: `S`
* 16: `E_next`

Intermediate spokes are solved by **latitude interpolation between anchors**:

* In each quarter, target latitude value is linearly interpolated.
* Timestamp is solved by root-finding `lat_nodal(t) = targetLat` inside that quarter.
* If local solve fails, quarter-linear time fallback is used.

Final spokes are strictly monotonic in time.

---

## Spoke meta returned by solver

Each spoke includes:

* `nodalLatitudeDeg`
* `distanceAu`
* `distanceKm`

So UI can show both:

* geometric node-cycle state (north/south crossing structure),
* and physical distance at each spoke.

---

## Tags semantics

Core tags from solver include:

* `E-nodal`, `ascending node`
* `W-nodal`, `descending node`
* `N-nodal`, `max latitude`, `north apex`
* `S-nodal`, `min latitude`, `south nadir`
* `north side` / `south side` for intermediate spoke regions
* `cycle start`, `cycle end`, and cycle duration tag on `E`

These tags are intended for composite wheels and tooltip semantics.

---

## Examples

`Sun Nodal: Earth - Moon`

* looker: Sun
* focus: Earth
* target: Moon

Classic draconic-like node cycle of the Moon relative to the Earth-Sun reference plane.

`Earth Nodal: Sun - Pluto`

* looker: Earth
* focus: Sun
* target: Pluto

Long nodal cycle with very wide search windows due to slow orbital motion.

---

## What Nodal Wheel is not

Nodal Wheel is not:

* horizon visibility cycle (Horizon)
* angular phase cycle (Synod)
* distance-only cycle (Bind)

It describes **plane-crossing latitude structure** of orbital motion.

