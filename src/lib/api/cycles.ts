import { solveSynodWheel, synodInstantAt } from '../math/synod';
import { solveSeasonWheel } from '../math/season';
import { solveBindWheel } from '../math/bind';
import { solveNodalWheel } from '../math/nodal';
import { solveHorizonWheel, computeHorizonInstant } from '../math/horizon';
import { solvePlatoWheel } from '../math/plato';
import { bind } from '../catalog/wheels/bind';
import { objects, isReferenceLikeKind, type ObjId } from '../catalog';
import type { CycleSolveResult } from '../board/runtime';
import { longCyclesAt } from './calendar';

export type CycleContext = { ts: number; timezone: string; latitude?: number; longitude?: number; target?: ObjId; looker?: ObjId };
type Definition = { id: string; description: string; source: string; parameters: string[]; gregorianYears: [number, number] | null; evaluate: (context: CycleContext) => unknown };
const registry: Definition[] = [];
const add = (id: string, description: string, source: string, evaluate: Definition['evaluate'], parameters: string[] = [], gregorianYears: Definition['gregorianYears'] = [1001, 2999]) => registry.push({id, description, source, parameters, gregorianYears, evaluate});

/** Preserve wheel geometry and event precision; only adapt public timestamp units. */
export function wheelData(result: CycleSolveResult) {
  if (!result.ok || result.spokes.length !== 17) return { status: 'unavailable', reason: 'The existing solver could not resolve this cycle at the requested moment.' };
  const ms = result.ts;
  const current = result.spokes.findIndex((s, i) => i < 16 && s.ts <= ms && result.spokes[i + 1].ts > ms);
  return { status: 'available', startTimestamp: result.spokes[0].ts / 1000,
    endTimestampExclusive: result.spokes[16].ts / 1000,
    elapsedTimeFraction: (ms - result.spokes[0].ts) / (result.spokes[16].ts - result.spokes[0].ts),
    segment: current < 0 ? null : result.spokes[current].code,
    spokes: result.spokes.map(s => ({code: s.code, timestamp: s.ts / 1000, data: Object.fromEntries(
      Object.entries(s.meta ?? {}).map(([key, value]) => [key === 'exactTs' ? 'exactTimestamp' : key, key === 'exactTs' && typeof value === 'number' ? value / 1000 : value])
    )})) };
}
add('harmonic_long_cycles', 'Great Cycle, age and wave/X interval; civil-day progress.', 'calendar/core.ts', c => ({status: 'available', ...longCyclesAt(c.ts, c.timezone)}), [], null);
add('moon', 'Lunar synodic cycle. E=first quarter, N=full, W=last quarter, S=new. Spokes rounded to minutes.', 'math/synod.ts', c => ({
  ...wheelData(solveSynodWheel({wheelType: 'synod', looker: 'Sun', focus: 'Earth', target: 'Moon', ts: c.ts})),
  instant: instant('Sun', 'Earth', 'Moon', c.ts)
}));
function instant(looker: ObjId, focus: ObjId, target: ObjId, ts: number) {
  const value = synodInstantAt(looker, focus, target, ts);
  if (!value) return null;
  return {phaseDeg: value.phaseDeg, motion: value.motion, distanceAu: value.distanceAu, focusDistAu: value.focusDistAu};
}
add('solar', 'Tropical seasonal cycle. E=March equinox, N=June solstice, W=September equinox, S=December solstice. Approximate polynomial model.', 'math/season.ts', c => wheelData(solveSeasonWheel({wheelType: 'season', focus: 'Sun', target: 'Earth', ts: c.ts})));
for (const role of bind.roles) {
  const focus = role.focus[0], target = role.target[0];
  const id = target === 'Moon' ? 'lunar_anomalistic' : target === 'Earth' ? 'solar_anomalistic' : `${target.toLowerCase()}_anomalistic`;
  add(id, `${focus}–${target} distance cycle. E=rising midpoint, N=maximum, W=falling midpoint, S=minimum.`, 'math/bind.ts', c => wheelData(solveBindWheel({wheelType: 'bind', focus, target, meta: role.meta, ts: c.ts})));
}
const planets = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'] as const;
for (const target of ['Moon', ...planets] as const) {
  const lunar = target === 'Moon';
  add(lunar ? 'lunar_draconic' : `${target.toLowerCase()}_nodal`, `${target} orbital nodes. E=ascending node, W=descending node, N/S=latitude extrema.`, 'math/nodal.ts', c => wheelData(solveNodalWheel({wheelType: 'nodal', looker: lunar ? 'Sun' : 'Earth', focus: lunar ? 'Earth' : 'Sun', target, ts: c.ts})));
  if (!lunar) add(target.toLowerCase(), `${target} synodic cycle, looker=Earth, focus=Sun. Spokes rounded to minutes.`, 'math/synod.ts', c => ({
    ...wheelData(solveSynodWheel({wheelType: 'synod', looker: 'Earth', focus: 'Sun', target, ts: c.ts})), instant: instant('Earth', 'Sun', target, c.ts)
  }));
}
add('diurnal', 'Earth observer horizon cycle. E=rise, N=upper culmination, W=set, S=lower culmination. May be unavailable at polar locations.', 'math/horizon.ts', c => {
  const location = {id: 'api', label: 'API observer', lat: c.latitude!, lon: c.longitude!, tz: c.timezone};
  const target = c.target ?? 'Sun';
  return {...wheelData(solveHorizonWheel({wheelType: 'horizon', looker: 'Earth', target, location, ts: c.ts})),
    instant: computeHorizonInstant({ts: c.ts, target, location})};
}, ['latitude', 'longitude', 'target']);
add('plato', 'Earth axial precession relative to a catalog reference. Default reference=Polaris; precession belt references may be unavailable.', 'math/plato.ts', c => wheelData(solvePlatoWheel({wheelType: 'plato', looker: c.looker ?? 'ref:polaris', target: 'Earth', ts: c.ts}, 0)), ['looker'], [-9999, 9999]);

export const CYCLES = new Map(registry.map(c => [c.id, c]));
export const CYCLE_UNITS = { timestamp: 'Unix seconds (UTC)', '*Deg': 'degrees', '*Rad': 'radians', raHours: 'hours', '*Au': 'astronomical units', '*Km': 'kilometres', '*Fraction': 'unitless fraction; elapsed time, not angular phase', '*Days': 'civil days', orbit: 'unitless UI radius', visible: 'boolean; geometric altitude >= 0' };
export function cycleDescriptions() {
  return { units: CYCLE_UNITS, cycles: registry.map(({evaluate: _evaluate, ...description}) => description),
    targets: Object.values(objects).flatMap(o => o ? [o.id] : []), lookers: Object.values(objects).flatMap(o => o && isReferenceLikeKind(o.kind) ? [o.id] : []) };
}
