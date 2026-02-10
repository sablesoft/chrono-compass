import type { WheelSpec } from '../types';

export const ChannelWheel: WheelSpec = {
    type: 'channel',
    roles: [
        // Sun Channel: Earth – Moon
        // The Sun is always a terminal body in this configuration and can never
        // occupy the central position between Earth and Moon due to scale.
        // The Moon acts as a channel (mediator) between the Sun and the Earth:
        // configurations like Sun – Moon – Earth are possible (e.g. during solar eclipses),
        // while Sun – Earth – Moon is also possible, but Sun is never central.
        // Therefore this configuration satisfies the Channel Wheel definition.
        {
            looker: ['Sun'],
            focus: ['Earth'],
            target: ['Moon']
        }
    ]
};
