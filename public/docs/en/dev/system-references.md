# Update: Support `reference` targets in System Wheel

## Goal

Extend the `system` wheel algorithm so that `target` can represent not only dynamic bodies but also static directional references.

Two target types must be supported:

* `engine_body` — existing behaviour (objects with orbital motion)
* `reference` — static directional objects (stars or other reference directions)

## Reference behaviour

Reference targets do not orbit the focus and do not produce cycles.

Instead, the solver must:

* compute the angle of the direction relative to the wheel plane and orientation
* compute the elevation angle relative to the plane

These objects represent fixed directions in space.

## Rendering semantics

Reference targets must be returned by the solver together with normal bodies.

Unlike bodies:

* they do not have orbital tracks
* their position does not change with time
* they are rendered as static markers

Their radius is fixed and places them in the outer reference ring of the wheel.
