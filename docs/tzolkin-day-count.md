# Tzolkin Day Count

## Purpose

Chrono Compass treats the Tzolkin as a continuous 260-day cycle tied to real elapsed days.

The application will not ship with a fixed built-in calendar correlation. Instead, each user may choose any civil date as an anchor and declare that date to be **Kin 1: Red Magnetic Dragon**. All other Kin values are then derived continuously from that anchor.

This keeps the 260-day structure independent from any particular historical or modern correlation system.

## Core rule

The day count is continuous.

Every real civil day advances the Tzolkin by exactly one Kin:

```text
Kin 1 -> Kin 2 -> ... -> Kin 260 -> Kin 1 -> ...
```

There are no omitted civil days and no special days that pause the count.

In particular, **February 29 is an ordinary Tzolkin day**. In a leap year:

```text
February 28 -> Kin N
February 29 -> Kin N + 1
March 1     -> Kin N + 2
```

The Gregorian leap-day rule belongs to the civil calendar used to name dates. It does not alter the internal rhythm of the Tzolkin.

## User-defined anchor

The only correlation setting required by Chrono Compass is a user-defined anchor:

```text
selected civil date = Kin 1, Red Magnetic Dragon
```

From that date, the application counts one Kin per elapsed civil day in both directions.

Conceptually:

```text
kinIndex = floorMod(dayDifference(date, anchorDate), 260)
kin = kinIndex + 1
```

The anchor is a personal setting, not a claim that a particular correlation is universally correct.

A user who prefers a traditional Maya correlation, a modern correlation, an experimental correlation, or a completely personal starting point may simply enter the corresponding anchor date. Chrono Compass does not need separate presets for these systems because they all reduce to the same operation: choosing the date assigned to Kin 1.

The selected anchor should be stored locally in the browser so that the user's count remains stable between visits. The user must be able to change or reset it at any time.

## Why Chrono Compass does not use the Dreamspell day count

Dreamspell / the 13 Moon Calendar does not treat Gregorian February 29 as an ordinary Galactic Signature. The Foundation for the Law of Time designates leap day as **0.0 Hunab Ku**, outside the normal 260-Kin sequence. Its own materials explicitly state that leap day has no regular Galactic Signature and that the sequence resumes afterward.

As a result, when a February 29 occurs between two dates, the Dreamspell Kin sequence advances by only 260 Kin across 261 elapsed civil days.

Chrono Compass deliberately does **not** reproduce this behavior.

For Chrono Compass, the Tzolkin is intended to be used as a lived sequence of real days. If a practitioner follows a 260-day cycle, then all 260 steps must correspond to 260 consecutively experienced days. Removing a real day from the count because of a rule in another civil calendar breaks that continuity.

Therefore:

- Chrono Compass will not implement `0.0 Hunab Ku` as a skipped Tzolkin day.
- Chrono Compass will not pause the Kin sequence on February 29.
- Chrono Compass will not provide the Dreamspell Gregorian correlation as an alternative counting mode.
- Dreamspell Solar Seal, Galactic Tone, Wavespell, and related structural concepts may still be used where relevant; rejecting the Dreamspell leap-day correlation does not require rejecting those structures.

This is an intentional design decision, not an attempt to redefine Dreamspell itself. Chrono Compass simply uses a different rule for mapping the 260-Kin structure onto real dates.

## Calendar-day arithmetic

Implementation must operate on **civil days**, not elapsed local-clock milliseconds.

The Kin for a date depends only on the integer number of calendar days between that date and the anchor. Daylight-saving transitions, time-zone offset changes, and other clock irregularities must never add or remove a Kin.

A robust implementation should normalize date-only values to a stable integer day representation before taking the modulo-260 difference.

The required invariant is:

> Advancing the displayed civil date by one day always advances the Tzolkin by exactly one Kin.

## Separation of structure and correlation

The Tzolkin structure is fixed:

- 20 Solar Seals;
- 13 Galactic Tones;
- 260 Kin;
- the repeating Seal/Tone sequence;
- Wavespells and other structural relationships derived from that sequence.

The date correlation is variable:

- one user-selected civil date is assigned to Kin 1;
- all other dates follow from continuous day arithmetic.

This separation lets Chrono Compass explore the Tzolkin as a coherent temporal structure without declaring one external historical correlation to be mandatory.

## References

- Foundation for the Law of Time, Galactic Signature decoder: February 29 is identified as `0.0 Hunab Ku` rather than a normal Galactic Signature: https://lawoftime.org/decode/
- Foundation for the Law of Time, 13 Moon Calendar FAQ: leap day is treated as an intercalary `0.0 Hunab Ku` day: https://lawoftime.org/thirteenmoonfaq.html
- Smithsonian National Museum of the American Indian, *Living Maya Time*: the Tzolk'in / Chol Q'ij is described as a 260-day cycle formed by the permutation of 20 day signs and 13 numbers: https://maya.nmai.si.edu/sites/default/files/transcripts/tzolkin.pdf
