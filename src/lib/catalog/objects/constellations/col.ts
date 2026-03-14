import type { ConstellationObj } from '../../types';

export const CONSTELLATION_COL: ConstellationObj = {
    "id": "ref:constellation:col",
    "kind": "constellation",
    "name": "Columba",
    "description": "Columba boundary polygon from Delporte/IAU data (B1875).",
    "emoji": "✧",
    "meta": {
        "name": "Columba",
        "abbr": "Col",
        "band": "south",
        "polygonEpoch": "B1875",
        "polygons": [
            [
                {
                    "raDeg": 75,
                    "decDeg": -43
                },
                {
                    "raDeg": 75,
                    "decDeg": -27.25
                },
                {
                    "raDeg": 91.75005,
                    "decDeg": -27.25
                },
                {
                    "raDeg": 91.75005,
                    "decDeg": -33
                },
                {
                    "raDeg": 98.74995,
                    "decDeg": -33
                },
                {
                    "raDeg": 98.74995,
                    "decDeg": -43
                },
                {
                    "raDeg": 90,
                    "decDeg": -43
                }
            ]
        ]
    }
};
