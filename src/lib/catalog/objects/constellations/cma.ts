import type { ConstellationObj } from '../../types';

export const CONSTELLATION_CMA: ConstellationObj = {
    "id": "ref:constellation:cma",
    "kind": "constellation",
    "name": "Canis Major",
    "description": "Canis Major boundary polygon from Delporte/IAU data (B1875).",
    "emoji": "✧",
    "meta": {
        "name": "Canis Major",
        "abbr": "CMa",
        "band": "south",
        "polygonEpoch": "B1875",
        "polygons": [
            [
                {
                    "raDeg": 91.75005,
                    "decDeg": -11
                },
                {
                    "raDeg": 110.50005,
                    "decDeg": -11
                },
                {
                    "raDeg": 110.50005,
                    "decDeg": -33
                },
                {
                    "raDeg": 98.74995,
                    "decDeg": -33
                },
                {
                    "raDeg": 91.75005,
                    "decDeg": -33
                },
                {
                    "raDeg": 91.75005,
                    "decDeg": -27.25
                }
            ]
        ]
    }
};
