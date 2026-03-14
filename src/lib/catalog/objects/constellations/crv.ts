import type { ConstellationObj } from '../../types';

export const CONSTELLATION_CRV: ConstellationObj = {
    "id": "ref:constellation:crv",
    "kind": "constellation",
    "name": "Corvus",
    "description": "Corvus boundary polygon from Delporte/IAU data (B1875).",
    "emoji": "✧",
    "meta": {
        "name": "Corvus",
        "abbr": "Crv",
        "band": "south",
        "polygonEpoch": "B1875",
        "polygons": [
            [
                {
                    "raDeg": 192.49995,
                    "decDeg": -11
                },
                {
                    "raDeg": 192.49995,
                    "decDeg": -22
                },
                {
                    "raDeg": 188.74995,
                    "decDeg": -22
                },
                {
                    "raDeg": 188.74995,
                    "decDeg": -24.5
                },
                {
                    "raDeg": 177.49995,
                    "decDeg": -24.5
                },
                {
                    "raDeg": 177.49995,
                    "decDeg": -11
                }
            ]
        ]
    }
};
