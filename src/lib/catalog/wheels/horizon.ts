import type { WheelSpec } from '../types';

export const HorizonWheel: WheelSpec = {
    type: 'horizon',
    roles: [
        // Earth Horizon: Sun / Moon
        // (For a typical Earth surface observer both cross the horizon; polar edge cases exist,
        // but at this MVP level we allow the pair.)
        {
            looker: ['Earth'],
            target: ['Sun', 'Moon']
        }
    ]
};