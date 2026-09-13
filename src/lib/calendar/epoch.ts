import { gregorianDay } from './core';

/**
 * Calendar v1 epoch, independently selected from individual December-solstice years.
 * JPL Horizons DE441, geocentric apparent longitude 270 degrees (IAU76/80 of date), TT.
 * Search: interval start years -1499..1000 (1500 BCE..1000 CE), inclusive.
 * Longest interval starts in astronomical year -554 (555 BCE).
 * Start JD TT 1519069.8369631595; end 1519435.0889383198.
 * S1 of the first F1 year is the civil day after the initial solstice, using UT midnight
 * for the epoch convention: proleptic Gregorian -0554-12-22.
 * Calendar dates thereafter follow civil date labels in the selected location.
 * Astronomy is not needed at runtime. See docs/calendar-epoch.md for limitations.
 */
export const CALENDAR_EPOCH_DAY = gregorianDay(-554, 12, 22);
