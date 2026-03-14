import type { ConstellationObj } from '../../types';

export const CONSTELLATION_SCL: ConstellationObj = {
    "id": "ref:constellation:scl",
    "kind": "constellation",
    "name": "Sculptor",
    "description": "Sculptor boundary polygon from Delporte/IAU data (B1875).",
    "emoji": "✧",
    "meta": {
        "name": "Sculptor",
        "abbr": "Scl",
        "band": "south",
        "polygonEpoch": "B1875",
        "polygons": [
            [
                {
                    "raDeg": 345,
                    "decDeg": -25.5
                },
                {
                    "raDeg": 357.49995,
                    "decDeg": -25.5
                },
                {
                    "raDeg": 25.00005,
                    "decDeg": -25.5
                },
                {
                    "raDeg": 25.00005,
                    "decDeg": -40
                },
                {
                    "raDeg": 349.99995,
                    "decDeg": -40
                },
                {
                    "raDeg": 349.99995,
                    "decDeg": -37
                },
                {
                    "raDeg": 345,
                    "decDeg": -37
                }
            ]
        ]
    }
};
