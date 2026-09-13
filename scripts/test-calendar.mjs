import assert from 'node:assert/strict';
import { PHRASES, DAYS_PER_GC, YEARS_PER_GC, fromDay, toDay, movePage,
  correctionDays, notation, gregorianDay, fromGregorianDay } from '../src/lib/calendar/core.ts';

assert.equal(PHRASES.length, 122);
assert.equal(PHRASES.filter(v => v === 1).length, 1);
assert.equal(PHRASES.filter(v => v === 4).length, 93);
assert.equal(PHRASES.filter(v => v === 7).length, 28);
assert.equal(YEARS_PER_GC, 21187);
assert.equal(DAYS_PER_GC, 21187 * 365 + 122 * 14 * 3);
assert.deepEqual(fromDay(0), {gc: 1, phrase: 1, wave: 0, year: 1, moon: 14, day: 1});
assert.equal(correctionDays(fromDay(0)), 4);
assert.equal(notation(fromDay(0)), '1.1(1).X.1.0.S1');
assert.equal(notation(fromDay(3)), '1.1(1).X.1.0.S4');
assert.equal(notation(fromDay(4)), '1.1(1).X.1.1.1');
assert.equal(notation(fromDay(367)), '1.1(1).X.1.13.28');
assert.equal(notation(fromDay(368)), '1.1(1).1.1.0.S');
assert.equal(notation(fromDay(369)), '1.1(1).1.1.1.1');

// Exhaust a whole Great Cycle, including every year/phrase/intercalary boundary.
for (let day = 0; day < DAYS_PER_GC; day++) {
  assert.equal(toDay(fromDay(day)), day);
}
for (const day of [-DAYS_PER_GC - 1, -DAYS_PER_GC, -1, DAYS_PER_GC, DAYS_PER_GC + 1]) {
  assert.equal(toDay(fromDay(day)), day);
}
const base = { gc: 1, phrase: 14, wave: 10, year: 13 };
for (const year of [12, 13]) {
  const outside = { ...base, year, moon: 14 };
  const moon1 = movePage(outside, 1);
  assert.deepEqual(moon1, { ...base, year, moon: 1 });
  assert.equal(correctionDays(outside), year === 13 ? 4 : 1);
  assert.deepEqual(movePage(moon1, -1), outside);
  const previousMoon13 = movePage(outside, -1);
  assert.equal(previousMoon13.moon, 13);
  assert.equal(previousMoon13.year, year - 1);
  assert.deepEqual(movePage(previousMoon13, 1), outside);
}
const last = fromDay(DAYS_PER_GC - 1);
const next = movePage(last, 1);
assert.deepEqual(next, { gc: 2, phrase: 1, wave: 0, year: 1, moon: 14 });
assert.equal(toDay({ ...movePage(next, -1), day: 28 }), DAYS_PER_GC - 1);
assert.throws(() => toDay({ ...base, wave: 14, moon: 1, day: 1 }));
assert.throws(() => toDay({ ...base, year: 12, moon: 14, day: 2 }));
assert.throws(() => toDay({ ...base, moon: 1, day: 29 }));
assert.throws(() => fromDay(0.5));

assert.equal(gregorianDay(1970, 1, 1), 0);
for (const year of [-20000, -400, -349, -1, 0, 1, 99, 100, 400, 1900, 2000, 2026, 2400, 30000]) {
  for (let month = 1; month <= 12; month++) {
    for (let day = 1; day <= 28; day++) {
      assert.deepEqual(fromGregorianDay(gregorianDay(year, month, day)), {year, month, day});
    }
  }
}
assert.equal(gregorianDay(2000, 3, 1) - gregorianDay(2000, 2, 28), 2);
assert.equal(gregorianDay(1900, 3, 1) - gregorianDay(1900, 2, 28), 1);
console.log(`Calendar checks passed: ${DAYS_PER_GC.toLocaleString('en-US')} days, navigation, invalid inputs, Gregorian BCE/leap boundaries.`);

// The selected epoch is the civil day following the initial December solstice.
const epoch = gregorianDay(-554, 12, 22);
assert.equal(notation(fromDay(gregorianDay(2026, 9, 11) - epoch)), '1.15(4).13.5.10.13');

assert.deepEqual(fromGregorianDay(epoch + 3), {year: -554, month: 12, day: 25});
assert.deepEqual(fromGregorianDay(epoch + toDay({...fromDay(0), moon: 1, day: 1})), {year: -554, month: 12, day: 26});
