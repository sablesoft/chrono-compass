# Tzolkin Tones

## Purpose

This document defines the 13-tone information that Chrono Compass may display in the future Tzolkin calendar UI.

Chrono Compass must keep two interpretive layers separate:

1. **Dreamspell Galactic Tones** — the modern Dreamspell system created by José and Lloydine Argüelles.
2. **Traditional / living Maya number meanings** — interpretations of the numbers 1–13 preserved in contemporary Maya Chol Q’ij practice.

These layers are related by the same 13-number cycle, but they are not historically identical systems and must not be presented as if one were a direct translation of the other.

The UI should eventually allow users to show or hide these information layers independently.

## Dreamspell Galactic Tones

Dreamspell assigns each tone a name plus three canonical keywords: **Essence**, **Power**, and **Action**.

For Chrono Compass these should be understood as three complementary descriptions of the same phase:

- **Essence** — the central quality or theme of the tone.
- **Power** — the kind of transformation or capacity associated with that tone.
- **Action** — the concrete operation through which that power is expressed.

The canonical Dreamspell table is:

| # | Tone | Essence | Power | Action |
| --- | --- | --- | --- | --- |
| 1 | Magnetic | Purpose | Unify | Attract |
| 2 | Lunar | Challenge | Polarize | Stabilize |
| 3 | Electric | Service | Activate | Bond |
| 4 | Self-Existing | Form | Define | Measure |
| 5 | Overtone | Radiance | Empower | Command |
| 6 | Rhythmic | Equality | Organize | Balance |
| 7 | Resonant | Attunement | Channel | Inspire |
| 8 | Galactic | Integrity | Harmonize | Model |
| 9 | Solar | Intention | Pulse | Realize |
| 10 | Planetary | Manifestation | Perfect | Produce |
| 11 | Spectral | Liberation | Dissolve | Release |
| 12 | Crystal | Cooperation | Dedicate | Universalize |
| 13 | Cosmic | Presence | Endure | Transcend |

### Dreamspell phase descriptions

**1 — Magnetic.** The cycle begins by establishing a purpose. A common aim unifies otherwise separate possibilities and creates a center of attraction around which the rest of the Wavespell can organize.

**2 — Lunar.** Purpose immediately encounters polarity: resistance, contrast, or a challenge. The two poles reveal what must be balanced and stabilized.

**3 — Electric.** The process becomes active. Service is expressed as function: energy begins to move by bonding previously separate elements into an operative relationship.

**4 — Self-Existing.** Activity acquires form. Definition, boundaries, proportion, and measurement turn an abstract process into a concrete structure.

**5 — Overtone.** Form becomes empowered and begins to radiate its quality outward. Command means coherent direction of the force that has gathered around the structure.

**6 — Rhythmic.** Energy is organized and distributed. Equality here is balance rather than sameness: the parts are arranged into a sustainable rhythm.

**7 — Resonant.** The central tone of the 13-part sequence is attunement. The formed and balanced system becomes receptive enough to channel and transmit inspiration.

**8 — Galactic.** The process is checked for integrity. What has been built must harmonize with its own principle and become a living model of that principle.

**9 — Solar.** Intention is concentrated into a pulse toward realization. The original purpose is now expressed as directed momentum through an already formed system.

**10 — Planetary.** The process produces a manifest result. To perfect here means to complete or bring into full expression rather than to demand abstract flawlessness.

**11 — Spectral.** Completed form is released. Structures and bonds that have fulfilled their purpose are dissolved so that the accumulated energy is no longer trapped in the result.

**12 — Crystal.** The released experience becomes cooperative and shareable. What was individual is dedicated to a larger whole and universalized through group relationship.

**13 — Cosmic.** The cycle culminates in presence. The completed experience endures while also transcending the form of the cycle, creating the threshold from one Wavespell into whatever follows.

## Traditional / living Maya number meanings

The following material is a compact summary of one documented contemporary K’iche’ Chol Q’ij lineage as published by Saq’ Be’. It should be presented as a **living Maya interpretation**, not as a universal ancient Maya dictionary of the numbers.

A useful organizing image in this tradition is a pyramid of energetic intensity: numbers 1–7 climb with effort; 8 is a summit where complete harmony is possible; numbers 9–13 descend with greater ease. Some teachings distinguish 8 as the male summit and 9 as the female summit.

| # | Traditional interpretation summary |
| --- | --- |
| 1 | Great primal force, unity, completeness of the first force, creative origin. Powerful but not yet flowing easily. |
| 2 | Polarity held in balance; two complementary or opposed energies. |
| 3 | Creative energy added to the polarity; the beginning of effective result and expression. |
| 4 | Balance and stability; four elements and four planes of manifestation: physical, mental, emotional, spiritual. |
| 5 | Elevation of creation; action energy; sometimes associated with the fifth element or ether. |
| 6 | Imbalance, tests, physical-world challenges, refinement, learning balance through difficulty. |
| 7 | Catalytic power, temptation and testing, the final difficult step before the summit; a force capable of harmonizing. |
| 8 | Complete material energy and the top of the pyramid; a point where perfect harmony is possible; associated in this teaching with male authority and creativity. |
| 9 | Emotional, intuitive and creative realization; associated in this teaching with female strength and a female energetic summit. |
| 10 | Creative energy flowing more easily; law, order and authority. |
| 11 | Tests and obligations of a more mental and spiritual kind; dividing, sorting, putting in order, sharing, and transmuting experience into knowledge. |
| 12 | Strong catalytic energy expressed through the group, family, association and collective relationship. |
| 13 | Realization and transmutation; the power to change and create; completion that also provides the foundation for another cycle. |

## Important distinction

Chrono Compass must not collapse the two systems into one table of supposed equivalents.

For example, Dreamspell Tone 2 is **Lunar / Challenge / Polarize / Stabilize**, while living Maya interpretations of the number 2 also emphasize polarity and balance. This is a meaningful structural resonance, but it is not proof that the Dreamspell formula is a direct historical translation of a single ancient Maya teaching.

The same caution applies to other apparent parallels, such as:

- 4: Dreamspell **Form / Define / Measure** and Maya themes of fourfold balance and manifestation;
- 8: Dreamspell **Integrity / Harmonize / Model** and Maya themes of summit and completed balance;
- 11: Dreamspell **Liberation / Dissolve / Release** and Maya themes of division, sorting, testing and transmutation;
- 12: Dreamspell **Cooperation / Dedicate / Universalize** and Maya themes of group and family;
- 13: Dreamspell **Presence / Endure / Transcend** and Maya themes of realization and transmutation.

These parallels are useful for comparison, but the UI and documentation should preserve source identity.

## UI intent

Tone information should be modular. A user may eventually choose to display any combination of:

- tone number and glyph;
- Dreamspell tone name;
- Dreamspell Essence / Power / Action;
- expanded Dreamspell phase description;
- traditional / living Maya number interpretation.

The calendar itself must remain usable even when all interpretive text is disabled.

## References

- Foundation for the Law of Time, *13 Moon Almanac*, “The 13 Galactic Tones”: https://www.lawoftime.org/pdfs/13MoonAlmanac-LawofTime.pdf
- Foundation for the Law of Time, Galactic Information Booth, Seals and Tones: https://www.lawoftime.org/infobooth/sealsandtones.html
- Saq’ Be’, “The Thirteen Numbers of the Cholq’ij”: https://sacredroad.org/cholqij-tzolkin-calendar/thirteen-numbers/
- Smithsonian National Museum of the American Indian, *Living Maya Time*, Maya Calendar System: https://maya.nmai.si.edu/sites/default/files/resources/The%20Maya%20Calendar%20System.pdf
