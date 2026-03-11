import type { InfoItem } from '../wheel/types';

export const STAR_INFO_ITEMS: InfoItem[] = [
    {
        defaultLabel: 'Ecl',
        metaField: 'eclipticLatDeg',
        format: 'deg',
        modal: 'Ecliptic latitude is the angular offset of the target from the ecliptic plane. Positive values are north of the plane, negative values are south.'
    },
    {
        defaultLabel: 'Vis Mag',
        metaField: 'apparentMagnitude',
        format: 'mag',
        modal: 'Apparent magnitude is the observed brightness of a star from Earth. Smaller numbers mean brighter stars; negative values are especially bright.'
    },
    {
        defaultLabel: 'Dist Ps',
        metaField: 'distanceAu',
        format: 'pc',
        modal: 'Distance in parsecs (pc). Parsec is the standard astronomical unit for stellar catalogs and parallax-based distances.'
    },
    {
        defaultLabel: 'Dist Ly',
        metaField: 'distanceAu',
        format: 'ly',
        modal: 'Distance in light-years (ly). One light-year is the distance light travels in vacuum in one year.'
    }
];
