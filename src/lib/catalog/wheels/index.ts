import type { WheelSpec, WheelType } from '../types';

import { CompassWheel } from './compass';
import { HorizonWheel } from './horizon';
import { BindWheel } from './bind';
import { SeasonWheel } from './season';
import { SynodWheel } from './synod';
import { ChannelWheel } from './channel';
import { NodalWheel } from './nodal';
import { PlatoWheel } from './plato';
import { RangeWheel } from './range';

export const wheels: Record<WheelType, WheelSpec> = {
    compass: CompassWheel,
    horizon: HorizonWheel,
    bind: BindWheel,
    range: RangeWheel,
    season: SeasonWheel,
    synod: SynodWheel,
    channel: ChannelWheel,
    nodal: NodalWheel,
    plato: PlatoWheel
};
