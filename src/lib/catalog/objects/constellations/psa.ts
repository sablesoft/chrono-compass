import type { ConstellationObj } from '../../types';

export const CONSTELLATION_PSA: ConstellationObj = {
    "id": "ref:constellation:psa",
    "kind": "constellation",
    "name": "Pisces Austrinus",
    "description": "Pisces Austrinus boundary polygon from Delporte/IAU data (B1875).",
    "emoji": "✧",
    "meta": {
        "name": "Pisces Austrinus",
        "abbr": "PsA",
        "band": "south",
        "polygonEpoch": "B1875",
        "polygons": [
            [
                {
                    "raDeg": 345,
                    "decDeg": -25.5
                },
                {
                    "raDeg": 345,
                    "decDeg": -37
                },
                {
                    "raDeg": 319.99995,
                    "decDeg": -37
                },
                {
                    "raDeg": 319.99995,
                    "decDeg": -28
                },
                {
                    "raDeg": 319.99995,
                    "decDeg": -25.5
                },
                {
                    "raDeg": 328.00005,
                    "decDeg": -25.5
                }
            ]
        ]
    }
};
