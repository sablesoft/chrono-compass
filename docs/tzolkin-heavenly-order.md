# Tzolkin Heavenly Order

## Purpose

This document defines how Chrono Compass represents the stable relationships between the 20 Dreamspell Solar Seals on the future Tzolkin page. The relationships themselves are preserved; Chrono Compass changes only their spatial presentation.

The four seal colors already carry directional meaning:

| Color | Direction |
| --- | --- |
| Red | East |
| White | North |
| Blue | West |
| Yellow | South |

Therefore direction is treated as a structural coordinate, not merely a visual attribute.

## Space Cross

**Space Cross** is the Chrono Compass name for its direction-preserving variant of the Oracle cross, distinguished from the classic Dreamspell Fifth Force Oracle.

For a Destiny seal, Dreamspell defines three stable seal relationships: **Analog**, **Antipode**, and **Occult**. The **Guide** is intentionally excluded here because it also depends on the Galactic Tone; the Heavenly Order is a structure of the 20 seals themselves, not of the 260 Kin.

The classic Fifth Force Oracle uses fixed role positions: Antipode on the left, Analog on the right, and Occult below Destiny. This layout does not preserve the directional semantics of the seal colors.

Chrono Compass instead uses a direction-preserving rule:

```text
seal -> color -> direction -> position
```

In the Space Cross, **Destiny** remains the central seal. Its own direction can be understood as **Forward**. The other three spatial positions are **Left**, **Right**, and **Back**.

These are two separate systems of terms:

- Dreamspell relationship: **Analog / Antipode / Occult**
- Chrono Compass space position: **Left / Back / Right**

The Space Cross rotates with the direction of its Destiny seal. **Antipode is always in Back**, because its direction is opposite Destiny (180°). **Analog and Occult occupy Left and Right**, with which relationship appears on which side determined by the directions/colors of the seals.

### Example: Red Dragon

For Dragon:

| Relationship | Seal | Color | Direction | Space position |
| --- | --- | --- | --- | --- |
| Destiny | Dragon | Red | East | Forward |
| Analog | Mirror | White | North | Left |
| Antipode | Monkey | Blue | West | Back |
| Occult | Sun | Yellow | South | Right |

Facing East with Dragon, Mirror is on the left (North), Sun on the right (South), and Monkey is behind/opposite (West). Chrono Compass displays the Space Cross accordingly rather than assigning screen positions directly from Oracle relationships.

This should not be described as proving that the classic Oracle is "wrong." It is a different, role-fixed convention. Chrono Compass deliberately chooses the direction-preserving representation because compass directions are structural coordinates in the application.

## Heavenly Order

Following the Analog/Occult relationships across all 20 seals produces one closed cycle, called the **Heavenly Order** in Chrono Compass:

```text
Sun -> Storm -> Wind -> Earth -> Seed -> Eagle -> Worldbridger
-> Skywalker -> Star -> Monkey -> Dog -> Moon -> Human -> Hand
-> Wizard -> Serpent -> Warrior -> Night -> Mirror -> Dragon -> Sun
```

Along this cycle the colors repeat:

```text
Yellow -> Blue -> White -> Red
South  -> West -> North -> East
```

five times. Thus the 20 seals form a single cycle `C20`, with Analog and Occult as the two neighboring directions along that cycle.

Antipode adds the third stable connection. In Heavenly Order coordinates `h = 0..19`, it connects opposite vertices:

```text
P(h) = h + 10 (mod 20)
```

Examples include Sun <-> Dog, Storm <-> Moon, Wind <-> Human, Star <-> Mirror, and Monkey <-> Dragon.

The resulting graph is therefore a 20-cycle plus ten opposite-vertex edges: the 20-vertex **Möbius ladder**, equivalently the circulant graph `C20(1,10)`.

This gives a useful interpretation of each Space Cross: it is the local neighborhood of one seal inside a single global structure. Destiny has exactly three stable connections -- Analog, Occult, and Antipode -- rather than each seal having an isolated Oracle diagram.

## UI invariants

The Tzolkin implementation should preserve these rules:

1. Red = East, White = North, Blue = West, Yellow = South.
2. Destiny, Analog, Antipode, and Occult together occupy all four directions exactly once.
3. Destiny is the center of the Space Cross; its own direction is Forward.
4. Antipode is always 180° from Destiny and therefore always occupies Back.
5. Analog and Occult occupy Left and Right, determined by seal direction rather than relationship name.
6. Screen position is derived from seal direction, never directly from Oracle relationship.
7. The Heavenly Order and Möbius structure concern only the 20 Solar Seals. Guide/tone behavior is a separate layer.

The central design principle is simple: **the UI follows the directional structure; the directional structure does not follow the UI.**
