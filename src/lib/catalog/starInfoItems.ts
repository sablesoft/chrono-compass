import type { InfoItem } from '../wheel/types';

export const STAR_INFO_ITEMS: InfoItem[] = [
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
