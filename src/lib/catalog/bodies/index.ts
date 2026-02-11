import type { Body, BodyId } from '../types';

import { Sun } from './sun';
import { Earth } from './earth';
import { Moon } from './moon';
import { Mercury } from './mercury';
import { Venus } from './venus';
import { Mars } from './mars';
import { Jupiter } from './jupiter';
import { Neptune } from './neptune';
import { Pluto } from './pluto';
import { Saturn } from './saturn';
import { Uranus } from './uranus';

export const bodies: Partial<Record<BodyId, Body>> = {
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
};