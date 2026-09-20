# Epoch Calendar: epoch and implementation

The epoch is selected independently of modern calendar examples. The criterion is the longest **individual** interval between successive December solstices whose starting year is between 1500 BCE and 1000 CE inclusive (astronomical years -1499 through 1000). This is not the maximum of a moving average.

## Result and reproducibility

NASA/JPL Horizons DE441, Earth-centred apparent solar ecliptic longitude of date, quantity 31 (IAU76/80), longitude = 270 degrees, TT timescale:

| Candidate start | Start JD TT | End JD TT | Duration in days |
| --- | --- | --- | --- |
| 555 BCE (-554) | 1519069.8369631595 | 1519435.0889383198 | 365.25197516032495 |
| 1375 BCE (-1374) | See saved ranking | See saved ranking | 365.25195697532035 |

The maximum lasts 365 days 6 hours 2 minutes 50.65385 seconds. The runner-up is only 1.57118 seconds shorter. This ranking is specific to the stated ephemeris, event definition, timescale and search range; it is not a claim of exact historical timing independent of model uncertainty. Numerical root residuals below 0.03 seconds do not establish physical accuracy to that precision. In particular, do not substitute extrema of declination or a different ecliptic convention without recalculating the ranking.

`calendar-research/jpl-solstices.mjs` queries all 2501 solstices, refines the longitude roots, and ranks all 2500 intervals. Its saved starting estimates are in `epoch-results.json`; these are merely solver seeds, not the ranking source. Run it with Node 22+ and network access. It saves raw responses and `jpl-intervals.json`. The final original response is preserved as `jpl-range-3.txt`. `jpl-epoch-details.mjs` retrieves quantity 30 alongside 31 for the winning boundaries; its output is preserved too. None of these files is loaded by the application.

The initial event is proleptic Gregorian 555 BCE December 21, 08:05:13.617 TT. Horizons' historical Earth-rotation model gives approximately 03:08:24 UT. UT conversion is model-dependent. The chosen civil convention starts calendar day 1 on the following date, **555 BCE December 22** (astronomical date -0554-12-22), using the UT date of the event. The epoch is fixed once: changing location does not select a different ancient epoch. Today's date follows the civil date in the selected location.

Sources: [Horizons manual](https://ssd.jpl.nasa.gov/horizons/manual.html), [API parameters](https://ssd-api.jpl.nasa.gov/doc/horizons.html), [batch file API](https://ssd-api.jpl.nasa.gov/doc/horizons_file.html), [DE440/441 paper](https://ssd.jpl.nasa.gov/doc/Park.2021.AJ.DE440.pdf).

## Calendar convention

A1 begins with its one-year X interval, followed by thirteen 13-year waves. A4 and A7 have thirteen waves followed by X intervals of four and seven years. Every year starts with its own correction period: S1–S4 in the last year of each interval, N in other years, followed by thirteen 28-day Months. Thus epoch day 0 is S1, days 1–3 are S2–S4, and day 4 (555 BCE December 26) is Month 1 day 1. Correction belongs to the year that follows it. The short A1 X year retains its four correction days; year lengths and all GC boundaries are unchanged. X is represented internally as wave zero and displayed as X.

GC consists of A1, nine A4, the palindrome P1/P2/P4/P7/P7/P4/P2/P1, and eight A4. Each P contains thirteen ages; its A7 positions are P1: 7; P2: 4,10; P4: 3,6,8,11; P7: 1,3,5,7,9,11,13. Other positions are A4. These are explicit calendar design conventions, not astronomical discoveries. Totals: 122 ages, 21,187 years, 7,738,379 days. Earlier modern-date examples are superseded: 2026-09-11 maps to `1.15(4).13.5.10.13` under this epoch.

## Four-part process semantics

In Chrono Compass, the number **4** is not only a count of four directions or four colors. It is a coherent four-part semantic series used by the Epoch Calendar and related visual structures.

| Stage | Color | Direction | Element | Process meaning |
| --- | --- | --- | --- | --- |
| 1 | Red | East | Earth | Initiation: impulse, intention, desire, goal, plan, seed structure, the first push that gives a process something to become. |
| 2 | White | North | Air | Purification: effort, testing, refinement, spiritual work, movement and mediation; the connective medium through which separation becomes relation. |
| 3 | Blue | West | Water | Transformation and crisis: instability, lived sensation, events, encounter with the unknown, resonance with a larger reality, and accumulation of the energy of a new state. |
| 4 | Yellow / Gold | South | Fire | Completion, knowledge and evolution: stabilization of the new state into embodied or silent knowledge, synthesis of what came before, and the transition into a new turn of the process. |

The four rows are meant to describe one cyclic process, not four unrelated symbolic labels.

**Earth / East / Red / Stage 1** is the grounding impulse. It establishes the initial structure of possibility: a wish, aim, plan, intention or first decisive movement. Earth is therefore not merely static matter here; it is the first condition that gives the process a place and a direction.

**Air / North / White / Stage 2** is the refining and connecting phase. Air moves, crosses space and links what is separate. Symbolically it is the more spiritual element of the sequence: progress requires effort, trial, purification and the willingness to pass through resistance. This stage tests and clarifies the initial impulse.

**Water / West / Blue / Stage 3** is transformation and crisis. Water changes shape and carries the process into an unstable domain where the intended change begins to become real. This is the phase of lived sensation, events, encounters and plots rather than settled knowledge. West also represents the unknown or indescribable reality beyond the initial concepts and descriptions of East. When intention and effort become strong enough, the process enters into resonance with that larger reality and begins to receive direct confirmation through events: something that previously existed only as an idea suddenly starts to happen. This can feel vivid, surprising or dreamlike because the new state is real but not yet stable.

Crisis is therefore a normal and necessary part of development in this model, not a defect. A process that never enters crisis never truly exposes itself to transformation. During the Western phase, the new state must accumulate enough **energy** to sustain itself. If that energy is insufficient, the process can fall back toward an earlier phase and the transformation must be approached again. Water is therefore inexhaustible and generative, but also unstable.

**Fire / South / Yellow / Stage 4** is synthesis, completion, knowledge and evolution. Fire stabilizes what was only intermittently available in the Western phase. The result is no longer merely an event or sensation but an acquired capacity: the organism, person or system now **knows** the new state. This is especially important as a distinction between **understanding** and **knowledge**. Conceptual understanding, models and explanations belong primarily to the Eastern side of the cycle; Southern knowledge can be silent, embodied and operational. It may function correctly even when the person cannot fully explain how it functions.

In this sense, **experience** should be used carefully in Chrono Compass terminology. Water provides lived events, sensations and transformative encounters. Fire is where those events become consolidated experience in the stronger sense: stable knowledge, skill, wisdom or a new reality that can be inhabited reliably.

Completion is therefore not a dead end. Once knowledge has stabilized in the South, it can become the seed for another Eastern phase: new concepts, instructions, systems, plans or teachings can grow from the acquired silent knowledge. The cycle closes by generating the conditions for its own next beginning.

For the 28-day Month, the same sequence applies to its four seven-day weeks:

```text
Week 1 -> Red   -> East  -> Earth -> Initiation
Week 2 -> White -> North -> Air   -> Purification
Week 3 -> Blue  -> West  -> Water -> Transformation
Week 4 -> Gold  -> South -> Fire  -> Completion / Evolution
```

This four-part row is a **Chrono Compass interpretive convention**. It should be treated as an internal semantic layer of the calendar, not as a claim that this exact element mapping is inherited unchanged from Dreamspell or from a single historical Maya tradition.

### Example: learning to ride a bicycle

Learning to ride a bicycle is a simple model of the full four-part process.

**East / Earth / Initiation.** A person first has the idea or desire to ride. There is not yet skill or embodied knowledge. There is only an intention, image, goal or plan: the seed of a possible new reality.

**North / Air / Purification.** The person begins to practice. Balance fails, attempts are repeated, falls happen, concentration is required, and both physical and psychological resistance must be overcome. This phase demands attention, effort and strength of spirit. Air is the movement and mediation that carries the initial intention through resistance.

**West / Water / Transformation and crisis.** After enough effort, something qualitatively changes: the person suddenly finds themselves actually riding. The new reality is no longer merely imagined; it is being lived directly. Yet it remains unstable. The rider may hold the state briefly, lose it, regain it and fall out of it again. This is the crisis phase: the process has crossed into the unknown and is accumulating the energy required to stabilize a new mode of being.

**South / Fire / Knowledge.** Eventually enough of that new-state energy has accumulated that riding is no longer exceptional. The body simply knows how to ride. The person does not need to verbally calculate balance, steering and compensation moment by moment. The knowledge is embodied and can operate without conceptual explanation. Only afterward, from this stable knowledge, can the rider formulate new instructions, teach another person or build a more explicit theory of what they are doing. In that way the Southern result can seed a new Eastern beginning.

## Architecture and scope

`src/lib/calendar/core.ts` converts integer civil days to and from GC coordinates. Existing wheel angle/astronomy calculations do not encode GC ages, X intervals or correction days, so this requires a separate small pure module. Gregorian arithmetic supports BCE dates without JavaScript's year 0–99 constructor ambiguity. `epoch.ts` supplies the fixed origin. Runtime conversion needs no network or ephemeris.

`Calendar.svelte` reuses the existing location store and theme; `App.svelte` selects the page with `#calendar`. Each Month is a 7 × 4 grid with red, white, blue and gold week backgrounds from the project theme palette. Correction uses the existing wheel geometry: a full disk for S, or E/red S1, N/white S2, W/blue S3 and S/gold S4 sectors. Both use the same radius. Section navigation is a header menu beside the theme control, including a Gregorian placeholder. Period 14 is an internal sentinel for a separate S/S1–S4 screen at the beginning of the year; notation uses Month 0 for S/S1–S4, such as `1.1(1).X.1.0.S1`. From Month 1, back opens the same year’s correction; from correction, back opens Month 13 of the previous year; navigation crosses year, wave, age and GC boundaries. Gregorian labels can be toggled and the preference is saved locally. Supported GC input is -1000 through 1000, with astronomical-style integer numbering (including GC 0 before GC 1).

`seasonEvents.ts` adapts the existing Season wheel (Sun focus, Earth target). It selects only primary E/N/W/S anchors, maps timestamps into the selected location’s civil day, and subtracts the epoch. The optional Season events layer marks regular/free days and lists approximate local times. It deliberately retains the wheel’s polynomial approximation, including its TT-as-UTC simplification, and is restricted to Gregorian 1001–2999. This is separate from the JPL epoch research. The Bind adapter reuses Sun Bind: Earth with its catalog cycle duration; the lunar adapter traverses Sun/Earth/Month Synod cycles and excludes duplicate E_next boundaries. Both are restricted to Gregorian 1001–2999. All three layers share civil-day conversion, event details and marker formatting. Phase output retains the wheel’s minute rounding. Markers use upper-left lunar, upper-right Season and lower-right Bind positions, and repeat before list descriptions. Epoch Calendar is the default route; Wheels Dashboard remains available at #wheels. The calendar core remains independent of astronomy.

Validation: `npm run test:calendar` exhaustively checks day round trips across one whole GC, negative offsets, correction transitions, GC boundaries, invalid coordinates, Gregorian BCE/leap boundaries and a modern example. `npm run check` and `npm run build` validate integration. Browser interaction and offline installation have not been manually tested.


Display options use the existing `DropdownButton` component. `calendar/layers.ts` is the registry for each wheel’s label, legacy preference key, resolver, supported range and marker corner. Calendar rendering evaluates selected registry entries and renders their status and events generically. `calendar/events.ts` holds shared event formatting and civil-day conversion. Add future wheel adapters through the registry rather than introducing individual booleans or UI branches. Existing per-option localStorage values remain supported.
