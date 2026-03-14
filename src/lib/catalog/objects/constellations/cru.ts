import type { ConstellationObj } from '../../types';

export const CONSTELLATION_CRU: ConstellationObj = {
    "id": "ref:constellation:cru",
    "kind": "constellation",
    "name": "Crux",
    "description": "Crux boundary polygon from Delporte/IAU data (B1875).",
    "emoji": "✧",
    "meta": {
        "name": "Crux",
        "abbr": "Cru",
        "band": "south",
        "polygonEpoch": "B1875",
        "polygons": [
            [
                {
                    "raDeg": 177.49995,
                    "decDeg": -55
                },
                {
                    "raDeg": 192.49995,
                    "decDeg": -55
                },
                {
                    "raDeg": 192.49995,
                    "decDeg": -64
                },
                {
                    "raDeg": 177.49995,
                    "decDeg": -64
                }
            ]
        ]
    }
};
