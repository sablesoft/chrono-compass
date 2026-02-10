import type { WheelSpec } from '../types';

export const SeasonWheel: WheelSpec = {
    type: 'season',
    roles: [
        // Sun Season: Earth
        {
            focus: ['Sun'],
            target: ['Earth']
        },
        // Earth Season: Moon (minimal MVP allowance; meaning is “axis of Moon relative to Earth”)
        {
            focus: ['Earth'],
            target: ['Moon']
        }
    ]
};