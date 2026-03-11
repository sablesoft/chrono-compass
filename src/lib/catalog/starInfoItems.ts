import type { InfoItem } from '../wheel/types';

export const STAR_INFO_ITEMS: InfoItem[] = [
    {
        description: 'ecl',
        defaultLabel: 'Ecl',
        metaField: 'eclipticLatDeg',
        format: 'deg',
        modal: 'Ecliptic latitude is the angular offset of the target from the ecliptic plane. Positive values are north of the plane, negative values are south.'
    },
    {
        description: 'vis-mag',
        defaultLabel: 'Vis Mag',
        metaField: 'apparentMagnitude',
        format: 'mag',
        modal: 'Apparent magnitude is the observed brightness of a star from Earth. Smaller numbers mean brighter stars; negative values are especially bright.'
    },
    {
        description: 'dist-ps',
        defaultLabel: 'Dist Ps',
        metaField: 'distanceAu',
        format: 'pc',
        modal: 'Distance in parsecs (pc). Parsec is the standard astronomical unit for stellar catalogs and parallax-based distances.'
    },
    {
        description: 'dist-ly',
        defaultLabel: 'Dist Ly',
        metaField: 'distanceAu',
        format: 'ly',
        modal: 'Distance in light-years (ly). One light-year is the distance light travels in vacuum in one year.'
    }
];
