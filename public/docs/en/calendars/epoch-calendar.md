# Epoch Calendar

Epoch Calendar is ChronoCompass’s own calendar system. Its 28-day Months are calendar units rather than measurements of lunar phases.

It has a clear connection to the **13 Moon Calendar**, popularized by **José Argüelles and the Campaign for the New Time**: thirteen equal months and days outside the ordinary month grid. Epoch Calendar builds on that idea with its own astronomical epoch and a correction structure extending across much longer cycles.

## Why this calendar is built this way

**Epoch Calendar connects a regular everyday calendar with a much longer view of time.** Its name refers to a fixed astronomical starting point from which every day receives a place in the Great Cycle.

The first goal is **an independent calendar**, with its own continuous day count and rules for months, years and corrections. Unlike the familiar July 26 Gregorian correlation of the 13 Moon / Dreamspell tradition, Epoch Calendar does not restart on a fixed Gregorian anniversary or borrow Gregorian leap-year rules. Gregorian dates provide a way to compare the two calendars, rather than determine the structure of this one.

The **13 × 28-day grid** gives every month the same four-week shape. Free days carry the correction outside that grid, so months never need extra dates or changing lengths. They also provide a visible pause between one year’s final Month and the next year’s first Month.

The nested **13-year waves, ages and Great Cycle** organize corrections over progressively longer spans. The A1, A4 and A7 age types spread correction days over different numbers of years, producing different average year lengths. Their arrangement was designed to approximate slow changes in the December-solstice year, rather than use a single short correction pattern indefinitely.

The goal is **to account for the length of the seasonal year**, so calendar Months retain their position relative to the seasons and solstices as closely as possible over the Great Cycle.

Solstices are not expected to fall on one fixed calendar date. The December solstice may shift between the final days of Month 13, the free days and the opening days of Month 1. We regard this kind of variation as an acceptable trade-off within a calendar whose corrections are organized across the whole Great Cycle, rather than requiring the solstice to return to one date every year. The precise range across all 21,187 years still needs to be validated.

The practical aim is a predictable, self-contained calendar for daily use and a common date grid for exploring other cycles. Once its epoch and rules are fixed, dates can be calculated offline without observing the Sun each year.

**A shared time scale does not require shared calendar rules.** Epoch Calendar uses the same measured passage of time as other calendars, but gives each day its own calendar coordinate. Just as the same distance can be expressed in metres or feet, the same day can be expressed as a Gregorian date or an Epoch date without borrowing Gregorian months or leap-year rules.

To show today, the application reads the device’s clock and uses the selected time zone to identify the local day, which changes at midnight. It then finds that day’s position relative to the fixed epoch. Gregorian dates are used as an intermediate conversion format and for optional labels; they do not determine Epoch Calendar’s months, years or corrections.

## Finding a date

- **Today** opens the current period. The selected location’s time zone determines today’s civil date.
- **← / →** move one period backward or forward, including the free days between Month 13 and the following Month 1.
- Choose **Great Cycle, Age, Wave, Year and Month**, then press **Go** to open a specific date.
- Open **Display options** at the top of the calendar to choose date labels and wheel layers. Multiple options can be enabled together; your selections are saved.
- Enable **Gregorian dates** to show civil dates with abbreviated weekdays in the cells (for example, **13 Sep, Mon**) and the period’s date range. This preference is saved on your device.

Each Month contains **28 days**, arranged as four weeks of seven days. The week backgrounds repeat in this order: **red, white, blue, yellow**. The same palette adapts to light and dark themes.

## Free days between years

The sequence is:

**Free Day or Free Circle → Month 1 → … → Month 13 → next year’s free days.**

Free days sit between Month 13 and the following Month 1. They can be viewed as the close of one year or the opening of the next. For date notation and navigation, the application associates them with the following year: going back from Month 1 opens its free period; going back once more opens Month 13 of the previous year.

- **Free Day — S:** one day shown as an undivided circle. The year contains 365 days.
- **Free Circle — S1–S4:** four days shown as four sectors of an equally sized circle. The year contains 368 days.

| Day | Position | Color |
| --- | --- | --- |
| S1 | East / right | Red |
| S2 | North / top | White |
| S3 | West / left | Blue |
| S4 | South / bottom | Yellow |

The last year of each wave or short X interval is associated with a Free Circle; other years use a Free Day. The first A1 X interval has only one year, so its free period is a Free Circle.

## Free Days: a shared pause

Free Days sit between the final Month of one year and the first Month of the next, close to the December solstice. In the Northern Hemisphere, this is the longest night and the turning point toward longer days—a natural time to gather, reflect and welcome renewal. In the Southern Hemisphere, the same solar turning point marks the height of summer.

These days belong to neither month. They offer a shared pause: time to finish what needs finishing, rest, reconnect and consider what comes next. Families might gather, communities celebrate, and schools and workplaces close one chapter before opening another. Participation can take many forms, without requiring a shared religion or a single way of celebrating.

We deliberately use only **one or four free days**, considering these two lengths optimal for a wide range of practical purposes. A single **Free Day** provides a brief annual pause. The relatively rare four-day **Free Circle** marks boundaries of larger periods, including waves and ages, allowing more time for gatherings, travel, collective reflection and longer-term planning.

The intention is to make this pause meaningful across society—from individuals and households to businesses and public institutions. That includes people whose work cannot stop: essential services continue, while fair scheduling and alternative time off can help extend the opportunity to rest and participate to everyone.

Each person and organization remains free to choose their own schedules and days of rest. Still, we believe that **shared free days built into the calendar itself** can benefit the whole community: a common opportunity to pause, reconnect and spend time together, while respecting different ways of life. We see this as a small but tangible step toward bringing us closer together as one humanity.

## The numbers 4, 7 and 13

Epoch Calendar is organized around **4, 7 and 13**. Its other structural counts are built from these numbers and the basic unit of one day: four seven-day weeks make a 28-day Month, thirteen Months make the regular year, and thirteen-year Waves form the larger age structure. The correction pattern combines age types with short intervals of one, four or seven years.

There is a simple symmetry in these numbers: **4 is the middle position of the sequence 1–7, and 7 is the middle position of the sequence 1–13**. Equivalently, 7 = 2 × 4 − 1 and 13 = 2 × 7 − 1. This relationship is part of the calendar’s organizing idea, connecting its smaller and larger scales. It is a mathematical and design relationship, not by itself evidence of astronomical accuracy.

## Dreamspell Names

Enable **Dreamspell Names** in **Display options** to add the names of the thirteen galactic tones to Epoch Calendar’s Months, Waves and the thirteen Years within each Wave. Month 1 and Wave 1 are **Magnetic**, Month 2 and Wave 2 are **Lunar**, and so on. Names appear in parentheses after the numbered Month, Wave or Year, including in all three selectors. Year 1 of every Wave is Magnetic and Year 13 is Cosmic; numbering restarts in each Wave. In an Age of type 4, the four X years use harmonic action names instead. Your preference is saved on this device.

| Number | Tone |
| --- | --- |
| 1 | Magnetic |
| 2 | Lunar |
| 3 | Electric |
| 4 | Self-Existing |
| 5 | Overtone |
| 6 | Rhythmic |
| 7 | Resonant |
| 8 | Galactic |
| 9 | Solar |
| 10 | Planetary |
| 11 | Spectral |
| 12 | Crystal |
| 13 | Cosmic |

These names come from the modern **Dreamspell** system developed by **José and Lloydine Argüelles**, and the associated 13 Moon calendar tradition. The Foundation for the Law of Time lists the [thirteen tones](https://lawoftime.org/infobooth/sealsandtones.html) and their [use as month names](https://www.lawoftime.org/thirteenmoon/basics.html).

The four color-direction associations are **East / Red — Initiates**, **North / White — Refines**, **West / Blue — Transforms**, and **South / Yellow — Ripens**. The corresponding descriptive forms are *Initiating, Refining, Transforming* and *Ripening*. A four-color sequence is called a **Harmonic** (red, white, blue, yellow). Its individual positions carry the color and action names above. The Foundation explicitly describes this in its [Harmonics and Chromatics guide](https://www.lawoftime.org/pdfs/OvertoneMoon.pdf). These describe the four positions within a harmonic sequence; they should not be confused with Dreamspell’s five Time Cell categories: Input, Store, Process, Output and Matrix. See the Foundation’s [Thirteen Moons in Motion](https://www.lawoftime.org/pdfs/ThirteenMoonsinMotion.pdf).

In Epoch Calendar these are optional symbolic names applied by position, not a calculation of a Dreamspell date or a traditional Maya calendar conversion. They do not change calendar arithmetic, the epoch, astronomical events or numeric coordinates. The four weeks of each Month, the four days S1–S4 of a Free Circle, and the four X years at the end of an Age of type 4 are labelled **Initiate, Refine, Transform, Ripen**, in order. The **Week** line in the **Today** section below the grid shows today’s direction and action in one line, such as **West, Transform**, using the selected time zone. It continues to describe today while browsing other periods. These are Epoch Calendar’s applications of the four-part harmonic pattern. A single Free Day and X years in Ages of type 1 or 7 keep their existing labels.

## Chakras

**Chakras** is a separate display option, independent of Dreamspell Names. It assigns these symbolic names and colors to the seven positions of the Epoch week:

| Day | Name | Color |
| --- | --- | --- |
| 1 | Root | Red |
| 2 | Sacral | Orange |
| 3 | Solar Plexus | Yellow |
| 4 | Heart | Green |
| 5 | Throat | Blue |
| 6 | Third Eye | Indigo |
| 7 | Crown | Violet |

The **Day of Week** line in the **Today** section below the grid shows today’s name and color in one line, such as **Sacral, Orange**, using the selected time zone. It describes today even when another month is open. This sequence repeats with each Epoch week and is independent of Gregorian weekday names. Free Days lie outside the weekly cycle and receive no chakra name.

This is Epoch Calendar’s chosen symbolic mapping, not the Dreamspell day-name system. It does not change date calculations. Both display options are saved separately on this device.

## Reading a calendar coordinate

The notation is **GC.A(type).W.Y.M.D**:

- **GC:** Great Cycle.
- **A(type):** age number within the Great Cycle and its type: 1, 4 or 7.
- **W:** wave number, or **X** for a short interval.
- **Y:** year within that wave or X interval.
- **M / D:** Month and day. Free days use Month **0** and **S** or **S1–S4**.

For example, **1.1(1).X.1.0.S1** is the first free day of the first year in the first Great Cycle. **1.1(1).X.1.1.1** is Month 1, day 1 of that year.

A wave contains 13 years. Every age contains 13 waves plus an X interval of 1, 4 or 7 years. A1 places X before its waves; A4 and A7 place X after them. One complete Great Cycle contains 122 ages, 21,187 years and 7,738,379 days. GC 0 denotes the cycle immediately before GC 1.

## The starting date

**22 December 555 BCE** is **S1** of the first A1 year. S2–S4 follow on 23–25 December; Month 1 begins on **26 December 555 BCE**. Ancient civil dates use the proleptic Gregorian calendar.

This epoch was chosen from the longest individual December-solstice interval beginning between 1500 BCE and 1000 CE in a JPL DE441 calculation. The initial civil date follows the calculated solstice’s UT date. The result depends on the astronomical model and event definition; it is not an exact historical observation. Changing the selected location does not change this fixed epoch.

Calendar dates are calculated locally. The calendar and this guide are available offline after the application’s offline resources have been installed. Enable **Season events** to mark the Season wheel’s March/September equinoxes and June/December solstices on the grid or Free Circle. Markers use **☀E** (March equinox), **☀N** (June solstice), **☀W** (September equinox) and **☀S** (December solstice). Hover a marker to see its full name and calculated timestamp in the selected time zone and UTC. A list below the period shows approximate local times. Events are assigned to civil days in the selected location, so changing time zone can move a marker to an adjacent day. This first layer reuses the wheel’s existing polynomial approximation, not the DE441 calculation used to choose the epoch. Its time-scale simplification and omitted corrections mean times are approximate; events close to midnight may be assigned to a neighboring day. The layer is limited to Gregorian years 1001–2999. Enable **Sun Bind: Earth** to add Earth–Sun distance events from the Bind wheel: **🌍E** is the midpoint crossing while moving away, **🌍N** is aphelion (maximum distance), **🌍W** is the midpoint crossing while moving closer, and **🌍S** is perihelion (minimum distance). These use the existing Astronomy Engine-based Bind solver and the wheel’s configured cycle duration. Midpoint crossings are distance events, not equinoxes. This layer currently supports Gregorian years 1001–2999. Multiple markers can share a day; the event list repeats each marker before its description. Both layers can be switched independently, and all dates follow the selected time zone.


Enable **Lunar phases** for the four principal phases from the Synod wheel (Sun looker, Earth focus, Moon target): **🌑 New Moon, 🌓 First quarter, 🌕 Full Moon, 🌗 Last quarter**. These mark phase events rather than assign a phase icon to every calendar day. The wheel rounds its output to the nearest minute. Phase symbols are conventional and do not depict the Moon’s local orientation in your sky.

The three layers use separate corners: lunar phases at the **upper left**, Season events at the **upper right**, and Sun Bind: Earth at the **lower right**. Events below the grid are grouped by wheel, with each wheel’s heading followed by its own events in time order. Each item repeats its marker before the description. Each layer can be switched independently.
