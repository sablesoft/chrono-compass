# Wheel

In **Chrono Compass**, a *Wheel* is the core abstraction used to describe any meaningful cyclic or structured relation.

A Wheel is **not a calendar**, **not a timeline**, and **not a prediction tool**.  
It is a **relational model**: a way to represent how bodies and orientations move through significant states or configurations.

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

### Body Role Attributes

These attributes always refer to **celestial bodies**.

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

- many bodies (stars, including the Sun) orbit the Galactic Center,
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

Directional orientation structures describing the azimuthal position of one or multiple target bodies around a looker body at a given moment.

Compass Wheels (or Rose Wheels) describe **spatial orientation**, not phase transitions.

Compass Wheel is a **root type**, intentionally designed and organized as a **navigation instrument** for the entire Chrono Compass system.  
They provide a shared spatial frame that connects multiple targets and serve as an entry point for exploring and switching between other Wheels associated with those targets.

**Required attributes:**
- looker
- target (one or many)
- observer

Compass Wheels do **not** require horizon crossings and are valid for any celestial bodies, for example:
- circumpolar bodies,
- the bodies always above or below the horizon,
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

Angular relation cycles describing the changing angle between focus and target bodies as evaluated from a looker body, where the looker may become centrally positioned between focus and target (true opposition is possible).

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

Angular alignment cycles describing the changing alignment between focus and target bodies as evaluated from a looker body, where the looker is always terminal and cannot occupy the central position.

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