import type { ConstellationObj } from '../../types';

export const CONSTELLATION_SCT: ConstellationObj = {
    "id": "ref:constellation:sct",
    "kind": "constellation",
    "name": "Scutum",
    "description": "Scutum boundary polygon from Delporte/IAU data (B1875).",
    "emoji": "✧",
    "meta": {
        "name": "Scutum",
        "abbr": "Sct",
        "band": "south",
        "polygonEpoch": "B1875",
        "polygons": [
            [
                {
                    "raDeg": 273.75,
                    "decDeg": -16
                },
                {
                    "raDeg": 273.75,
                    "decDeg": -4
                },
                {
                    "raDeg": 278.74995,
                    "decDeg": -4
                },
                {
                    "raDeg": 283.00005,
                    "decDeg": -4
                },
                {
                    "raDeg": 283.00005,
                    "decDeg": -12.03333
                },
                {
                    "raDeg": 283.00005,
                    "decDeg": -16
                }
            ]
        ]
    }
};
