import type { ConstellationObj } from '../../types';

export const CONSTELLATION_CRA: ConstellationObj = {
    "id": "ref:constellation:cra",
    "kind": "constellation",
    "name": "Corona Australis",
    "description": "Corona Australis boundary polygon from Delporte/IAU data (B1875).",
    "emoji": "✧",
    "meta": {
        "name": "Corona Australis",
        "abbr": "Cra",
        "band": "south",
        "polygonEpoch": "B1875",
        "polygons": [
            [
                {
                    "raDeg": 267.49995,
                    "decDeg": -37
                },
                {
                    "raDeg": 287.50005,
                    "decDeg": -37
                },
                {
                    "raDeg": 287.50005,
                    "decDeg": -45.5
                },
                {
                    "raDeg": 270,
                    "decDeg": -45.5
                },
                {
                    "raDeg": 267.49995,
                    "decDeg": -45.5
                }
            ]
        ]
    }
};
