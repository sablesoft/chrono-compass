// src/lib/catalog/wheels/index.ts
import type { WheelSpec, WheelType } from '../types';

import { compass } from './compass';
import { horizon } from './horizon';
import { synod } from './synod';
import { bind } from './bind';
import { range } from './range';
import { season } from './season';
import { nodal } from './nodal';
import { plato } from './plato';
import { system } from './system';
import { galaxy } from './galaxy';

// тип: для каждого ключа — свой конкретный кусок WheelSpec
export type WheelsCatalog = {
    [K in WheelType]: Extract<WheelSpec, { type: K }>
};

export const wheels: WheelsCatalog = {
    compass,
    horizon,
    system,
    bind,
    synod,
    range,
    season,
    nodal,
    plato,
    galaxy
};
