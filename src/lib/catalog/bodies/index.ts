import type { Body, BodyId } from '../types';

import { Sun } from './sun';
import { Earth } from './earth';
import { Moon } from './moon';

export const bodies: Partial<Record<BodyId, Body>> = {
    [Sun.id]: Sun,
    [Earth.id]: Earth,
    [Moon.id]: Moon
};