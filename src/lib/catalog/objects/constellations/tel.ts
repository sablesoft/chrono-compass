import type { ConstellationObj } from '../../types';

export const CONSTELLATION_TEL: ConstellationObj = {
    "id": "ref:constellation:tel",
    "kind": "constellation",
    "name": "Telescopium",
    "description": "Telescopium boundary polygon from Delporte/IAU data (B1875).",
    "emoji": "✧",
    "meta": {
        "name": "Telescopium",
        "abbr": "Tel",
        "band": "south",
        "polygonEpoch": "B1875",
        "polygons": [
            [
                {
                    "raDeg": 304.99995,
                    "decDeg": -57
                },
                {
                    "raDeg": 270,
                    "decDeg": -57
                },
                {
                    "raDeg": 270,
                    "decDeg": -45.5
                },
                {
                    "raDeg": 287.50005,
                    "decDeg": -45.5
                },
                {
                    "raDeg": 304.99995,
                    "decDeg": -45.5
                }
            ]
        ]
    }
};
