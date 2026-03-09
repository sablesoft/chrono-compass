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
import { Sirius } from './sirius';
import { Polaris } from './polaris';
import { Betelgeuse } from './betelgeuse';
import { Antares } from './antares';
import { Deneb } from './deneb';
import { Altair } from './altair';
import { Nunki } from './nunki';

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
    [Sirius.id]: Sirius,
    [Polaris.id]: Polaris,
    [Betelgeuse.id]: Betelgeuse,
    [Antares.id]: Antares,
    [Deneb.id]: Deneb,
    [Altair.id]: Altair,
    [Nunki.id]: Nunki,
} satisfies Partial<Record<ObjId, Obj>>;
