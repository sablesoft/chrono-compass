import type { Obj, ObjId } from '../types';

import { Sun } from './sun';
import { Earth } from './earth';
import { Moon } from './moon';
import { Mercury } from './mercury';
import { Venus } from './venus';
import { Mars } from './mars';
import { Jupiter } from './jupiter';
import { Saturn } from './saturn';
import { Uranus } from './uranus';
import { Neptune } from './neptune';
import { Pluto } from './pluto';
import {GalacticCenter} from "./galactic-center";
import { EclipticAxis } from './ecliptic-axis';

export const objects: Partial<Record<ObjId, Obj>> = {
    [Sun.id]: Sun,
    [Earth.id]: Earth,
    [Moon.id]: Moon,
    [Mercury.id]: Mercury,
    [Venus.id]: Venus,
    [Mars.id]: Mars,
    [Jupiter.id]: Jupiter,
    [Neptune.id]: Neptune,
    [Pluto.id]: Pluto,
    [Saturn.id]: Saturn,
    [Uranus.id]: Uranus,
    [GalacticCenter.id]: GalacticCenter,
    [EclipticAxis.id]: EclipticAxis,
} satisfies Partial<Record<ObjId, Obj>>;
