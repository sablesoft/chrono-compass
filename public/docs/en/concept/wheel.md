# Wheel

In **Chrono Compass**, a *Wheel* is the core abstraction used to describe any meaningful cyclic or structured relation.

A Wheel is **not a calendar**, **not a timeline**, and **not a prediction tool**.  
It is a **relational model**: a way to represent how objects move through significant states or configurations.

Time is only an underlying parameter.  
Meaning is defined by **geometry, orientation, distance, and relation**.

---

## What is a Wheel?

A Wheel represents a **structured relation** that can be expressed as:

- a closed cycle,
- or a stable directional structure,
- with well-defined reference points and semantics.

Every Wheel answers **exactly one question**.  
Different questions require different Wheel types.

---

## Wheel Attributes

Chrono Compass uses attributes of different conceptual levels.

---

### General Attribute

- **type**

Defines the class of relation described by the Wheel.

---

### Obj Role Attributes

These attributes always refer to **celestial objects**.

- **focus** — the structural reference body of the relation
- **target** — the body whose state is described, required for all wheel types
- **looker** — the body from whose spatial perspective the relation is evaluated

Each Wheel type requires a **strict, well-defined set** of body role attributes.

---

### Context Attribute

- **observer**

Defines a **local point on the surface** of a celestial body  
(e.g., latitude and longitude).

Observer is required only for Wheel types that involve a **looker horizon**.

---

## Attribute Definitions

### Type

**Type** defines *what kind of relation* the Wheel represents.

It answers the question:

> *What geometric or physical principle structures this relation?*

The type determines:
- which attributes are required,
- which quantities define phases, positions, wheel spokes and their houses
- how focal points are defined.

---

### Focus

**Focus** defines the *structural reference body* of the relation.

It answers the question:

> *Relative to which body is this relation defined?*

- Focus is always a celestial body.
- Focus may be absent for some Wheel types.
- As usual focus is the central body for the target.
- Sometimes but not always focus is the central body for the looker.

---

### Target

**Target** defines the body whose state is described by the Wheel.

It answers the question:

> *Which body is being tracked through this relation?*

- Target is always a celestial body.
- Target is required for all Wheel types.

---

### Looker

**Looker** defines the body from whose spatial perspective the relation is evaluated.

It answers the question:

> *From which body is this configuration considered?*

- Looker is always a celestial body.
- Looker is required only for perspective-based relations.
- Looker is not a local observer.

---

### Observer

**Observer** defines a local point on the surface of the looker body.

It answers the question:

> *From which local location is this relation evaluated?*

- Observer is not a celestial body.
- Observer represents local surface coordinates.
- Observer is required only for Wheel types involving a looker horizon.

---

---

## Upper Bound of Cyclic Structure

Chrono Compass models only **cyclic or quasi-cyclic relations** that arise from
stable orbital or rotational motion.

For any Wheel type that relies on orbital planes, axial motion, or repeated
phase structure, the existence of a **higher-level reference** is required.
This naturally introduces an **upper bound** to the depth of cyclic modeling.

In the current model, the **Galactic Center** represents the practical upper
limit of cyclic relations:

- many objects (stars, including the Sun) orbit the Galactic Center,
- but the Galactic Center itself does **not** orbit any higher-level focus,
- therefore it does not possess its own orbital plane.

As a result:
- Wheels may implicitly rely on the Galactic Center as a **terminal reference**,
- but no Wheel can be constructed *above* it,
- and no Nodal, Bind, or similar Wheel can treat the Galactic Center as a target
  that requires a higher-level orbital reference.

This constraint is intentional.

It prevents infinite hierarchical recursion and clearly separates:
- **cyclic structure** (modeled by Wheels),
- from **background motion and cosmological drift**, which lie outside the scope of Chrono Compass.

---

## Wheel Types

Chrono Compass defines several Wheel types.  
Each type specifies a distinct relational structure and a strict set of required attributes.

Each Wheel type is defined in its own concept file.

---

### Compass Wheels

Directional orientation structures describing the azimuthal position of one or multiple target objects around a looker body at a given moment.

Compass Wheels (or Rose Wheels) describe **spatial orientation**, not phase transitions.

Compass Wheel is a **root type**, intentionally designed and organized as a **navigation instrument** for the entire Chrono Compass system.  
They provide a shared spatial frame that connects multiple targets and serve as an entry point for exploring and switching between other Wheels associated with those targets.

**Required attributes:**
- looker
- target (one or many)
- observer

Compass Wheels do **not** require horizon crossings and are valid for any celestial objects, for example:
- circumpolar objects,
- the objects always above or below the horizon,
- stars and planets alike.

→ [compass.md](compass.md)

  *Examples:*  
  `Earth Compass: Sky`  
  (looker: Earth, targets: multiple, observer: Earth surface point)
  
  `Mars Compass: Phobos`  
  (looker: Mars, target: Phobos, observer: Mars surface point)
  
  `Jupiter Compass: Satellites`  
  (looker: Jupiter, targets: multiple, observer: Jupiter surface point)

---

### Horizon Wheels

Cycles of visibility and vertical motion of a target body relative to the local horizon of a looker body.

**Required attributes:**
  - looker
  - target
  - observer

Horizon Wheel exists for some target body only if this body **actually crosses the horizon** of the looker body.

  → [horizon-wheel.md](horizon-wheel.md)

  *Examples:*  
  `Earth Horizon: Sun`  
  (looker: Earth, target: Sun, observer: Earth surface point)

  `Earth Horizon: Moon`  
  (looker: Earth, target: Moon, observer: Earth surface point)

  `Mars Horizon: Sun`  
  (looker: Mars, target: Sun, observer: Mars surface point)

---

### Synod Wheels

Angular relation cycles describing the changing angle between focus and target objects as evaluated from a looker body, where the looker may become centrally positioned between focus and target (true opposition is possible).

Synod Wheels may be **centrical** or **acentrical**:
- **centrical** — the focus body is a common orbital focus for both the looker and the target;
- **acentrical** — all other cases, where the focus is not shared by looker and target.

The centrical case is a **special case of the acentrical one**, not a separate Wheel type.

**Required attributes:**
- looker
- focus
- target

  → [synod-wheel.md](synod-wheel.md)

  *Examples:*  
  `Earth Synod: Sun - Moon`  
  (looker: Earth, focus: Sun, target: Moon, acentrical case)

  `Earth Synod: Sun - Mars`  
  (looker: Earth, focus: Sun, target: Mars, centrical case)

  `Jupiter Synod: Sun - Saturn`  
  (looker: Jupiter, focus: Sun, target: Saturn, centrical case)

  **TODO:**
  - Implement a **single, general computation method** for Synod Wheels
    that correctly handles both centrical and acentrical cases.
  - Treat centrical configurations as an optimization case,
    not as a separate computational model.

---

### Channel Wheels

Angular alignment cycles describing the changing alignment between focus and target objects as evaluated from a looker body, where the looker is always terminal and cannot occupy the central position.

In this Wheel type the target acts as a channel (mediator) between looker and focus.

Channel Wheels may be **centrical** or **acentrical**:
- **centrical** — the focus body is a common orbital focus for both the looker and the target;
- **acentrical** — all other configurations.

The centrical case is a **special case of the acentrical one**, not a separate Wheel type.

**Required attributes:**
- looker
- focus
- target

  → [channel-wheel.md](channel-wheel.md)

  *Examples:*  
  `Earth Channel: Sun - Mercury`  
  (looker: Earth, focus: Sun, target: Mercury, centrical case)

  `Earth Channel: Jupiter - Io`  
  (looker: Earth, focus: Jupiter, target: Io, acentrical case)

  `Mars Channel: Sun - Earth`  
  (looker: Mars, focus: Sun, target: Earth, centrical case)

  **TODO:**
  - Implement a **single, general computation method** for Channel Wheels
    that does not rely on a shared orbital focus.
  - Ensure correct handling of both centrical and acentrical cases
    using a unified geometric approach.

---

### Bind Wheels

Orbital binding cycles describing the changing distance between a target body and its focus body.

**Required attributes:**
  - focus
  - target

  → [bind.md](bind.md)

  *Examples:*  
  `Sun Bind: Earth`  
  (focus: Sun, target: Earth)

  `Jupiter Bind: Io`  
  (focus: Jupiter, target: Io)

  `Saturn Bind: Titan`  
  (focus: Saturn, target: Titan)

---

### Range Wheels

Distance relations describing proximity between a looker body and a target body without orbital binding.

**Required attributes:**
  - looker
  - target

  → [range-wheel.md](range-wheel.md)

  *Examples:*  
  `Earth Range: Mars`  
  (looker: Earth, target: Mars)

  `Mars Range: Venus`  
  (looker: Mars, target: Venus)

  `Saturn Range: Earth`  
  (looker: Saturn, target: Earth)

---

### Season Wheels

Axial-orbital cycles describing the orientation of a target body’s rotational axis relative to its focus body.

**Required attributes:**
  - focus
  - target

  → [season-wheel.md](season-wheel.md)

  *Examples:*  
  `Sun Season: Earth`  
  (focus: Sun, target: Earth)

  `Jupiter Season: Io`  
  (focus: Jupiter, target: Io)

  `Sun Season: Mars`  
  (focus: Sun, target: Mars)

---

### Nodal Wheels

Cycles describing the motion of a target body’s orbital nodes relative to a **leading orbital plane**.

In a Nodal Wheel, the reference plane is the orbital plane of a **looker body** around its **focus body**.  
The nodes are defined as the intersections between:
- the orbital plane of the target body around the looker body, and
- the orbital plane of the looker body around the focus body.

A Nodal Wheel is well-defined only if:
- the target body orbits the looker body, and
- the looker body itself orbits the focus body, thereby providing a leading reference plane.

**Required attributes:**
- looker
- focus
- target

→ [nodal-wheel.md](nodal-wheel.md)

*Examples:*  
`Earth Nodal: Sun – Moon`  
(looker: Earth, focus: Sun, target: Moon)

`Jupiter Nodal: Sun – Europa`  
(looker: Jupiter, focus: Sun, target: Europa)

`Sun Nodal: Galaxy – Earth`  
(looker: Sun, focus: Galaxy, target: Earth)

---

### Plato Wheels

Cycles describing axial precession of a target body relative to an external reference body.

**Required attributes:**
  - looker
  - target

  → [plato-wheel.md](plato-wheel.md)

  *Examples:*  
  `Galaxy Plato: Earth`  
  (looker: Galaxy, target: Earth)

  `QuasarX Plato: Earth`  
  (looker: QuasarX, target: Earth)

  `Galaxy Plato: Mars`  
  (looker: Galaxy, target: Mars)

---

### System Wheels

System Wheels describe the spatial structure of a planetary system around its central star.

Unlike cyclic Wheels (Bind, Synod, Season), a System Wheel is not primarily about phase transitions.
It is a **structural spatial model** of a gravitational system.

A System Wheel answers the question:

> *How are objects arranged within a stellar system relative to a higher external reference?*

---

#### Conceptual Principle

A System Wheel models a **stellar system as a coherent gravitational unit**.

The star (focus) acts as the structural center.
Targets are objects gravitationally bound to the focus.

The Wheel defines:

* orbital radii (scaled or normalized),
* angular positions,
* orientation of the system relative to an external reference.

It is a structural map, not a cyclic phase model.

---

#### Required Attributes

##### General

* **type**: `system`

##### Obj Roles

* **looker** — external reference body (e.g., Galactic Center)
* **focus** — central star of the system (e.g., Sun)
* **target** — one or many objects orbiting the focus

##### Additional Attributes

* **projection** — projection mode

  * `polar` — view from system north pole
  * `equatorial` — view perpendicular to system north pole

* **plane** — reference plane of projection

  * `ecliptic` (default)
  * `galactic`

---

#### Geometric Structure

The System Wheel is a 3D structure represented through 2D projection.

##### Projection: `polar`

* Viewpoint: above the system north pole.
* Focus is at the center of the wheel.
* Orbital radii are projected radially.
* Angular positions are true orbital longitudes in the chosen plane.

Orientation:

* **S axis** points toward the looker.
* **N axis** points opposite the looker.
* **W/E** are perpendicular to S–N.

This projection preserves angular geometry within the orbital plane.

---

##### Projection: `equatorial`

* Viewpoint: perpendicular to the system north pole.
* Looker becomes the observer of the disk.
* N–S axis represents the system’s rotational axis.
* W–E axis represents the projection of the orbital plane.

In this mode:

* W–E distance from center reflects in-plane displacement.
* N–S displacement reflects height relative to chosen plane.

This projection reveals orbital inclination structure.

---

#### Semantics

System Wheels represent:

* gravitational hierarchy,
* spatial order,
* structural embedding of a planetary system inside a larger structure.

They do not define cyclic spokes.
They define **spatial configuration states**.

---

#### Examples

`Solar System (GC reference)`
(looker: Galactic Center, focus: Sun, targets: planets)

`Alpha Centauri System`
(looker: Galactic Center, focus: Alpha Centauri A, targets: bound objects)

---

### Galaxy Wheels

Galaxy Wheels describe the spatial structure of a galaxy relative to a **cosmological external reference**.

They model the galaxy as a coherent rotating disk embedded in large-scale cosmic flow.

A Galaxy Wheel answers the question:

> *How is a galaxy oriented and structured relative to the cosmic environment?*

---

#### Conceptual Principle

A Galaxy Wheel models a galaxy as a gravitational system embedded within the cosmic web.

The galactic center acts as structural focus.
Targets are objects or structures within the galaxy.
The looker is an external cosmological reference.

This Wheel establishes orientation of the galactic disk relative to:

* cosmic flow,
* supercluster structure,
* large-scale gravitational fields.

---

#### Required Attributes

##### General

* **type**: `galaxy`

##### Obj Roles

* **looker** — cosmological reference (e.g., CMB dipole direction or Great Attractor)
* **focus** — galactic center (GC)
* **target** — objects or structures within the galaxy

##### Additional Attributes

* **projection** — projection mode

  * `polar` — view from galactic north pole
  * `equatorial` — view perpendicular to galactic north pole

* **plane** — projection plane

  * `galactic` (default)
  * `cosmic-sheet`

---

#### Geometric Structure

Galaxy Wheel is a 3D disk projected into 2D.

##### Projection: `polar`

* Viewpoint: above galactic north pole.
* Focus (GC) at wheel center.
* Disk structure projected radially.

Orientation:

* **S axis** points toward the looker (e.g., CMB dipole direction).
* **N axis** opposite the looker.
* **W/E** are perpendicular within galactic plane.

This reveals spiral geometry and cosmic orientation simultaneously.

---

##### Projection: `equatorial`

* Viewpoint: perpendicular to galactic north pole.
* Looker becomes observer of the galactic disk.
* N–S axis represents galactic rotational axis.
* W–E axis represents projection of galactic plane.

In this mode:

* W–E displacement reflects radial galactic position.
* N–S displacement reflects height above or below galactic plane.

---

#### Semantics

Galaxy Wheels represent:

* galactic embedding in cosmic structure,
* orientation relative to universal motion,
* structural relationship between galaxy and supercluster dynamics.

They are not cyclic wheels.
They are **cosmic structural orientation models**.

---

#### Examples

`Milky Way (CMB reference)`
(looker: CMB dipole, focus: Galactic Center, targets: stellar populations)

`Andromeda Galaxy`
(looker: CMB dipole, focus: Andromeda GC, targets: galactic structures)

---

These two Wheel types extend Chrono Compass beyond orbital cycles
into hierarchical spatial architecture:

Planet → Star → Galaxy → Cosmic Flow.

## Overlapping Wheels

A single physical relation may be described by multiple Wheel types.

Chrono Compass represents such cases as:
- one Wheel definition,
- associated with multiple types.

---

## Purpose of Wheels

Wheels are the structural building blocks of Chrono Compass.

Each Wheel is simple.  
Meaning emerges from their **composition**, not from any single relation.
Chrono Compass It provides a coherent framework for navigating how different relational structures intersect.