// src/lib/catalog/types.ts
import { Body as EngineBody } from 'astronomy-engine';
import { SPOKES_ORDER, type InfoItem } from '../wheel/types';
import {objects} from "./objects";

/* =============================================================================
   Core scalar types
   ============================================================================= */

export type Vec3 = readonly [number, number, number];

/**
 * IDs supported by astronomy-engine.
 * Example: 'Earth', 'Moon', 'Sun'
 */
export type EngineBodyId = keyof typeof EngineBody;

/**
 * Any catalog object id:
 * - EngineBodyId: real body supported by the engine
 * - ref:*       : external reference / synthetic object (GC, GA, CMB dipole, etc.)
 */
export type ObjId = EngineBodyId | `ref:${string}`;
export type ConstellationRefId = `ref:constellation:${string}`;

/* =============================================================================
   Localization + Kind
   ============================================================================= */

export type ObjKind =
    | 'engine_body'     // exists in astronomy-engine (must use EngineBodyId)
    | 'reference'       // generic inertial/static references (must use ref:*)
    | 'star'            // stellar inertial references (must use ref:*)
    | 'pole'            // celestial poles (must use ref:*)
    | 'constellation';  // constellation boundary object (must use ref:*)

/* =============================================================================
   Meta for objects (references, constants, directions)
   ============================================================================= */

export type EngineBodyMeta = Record<string, never>;

export type ReferenceFrame =
    | 'icrf_j2000'     // inertial frame (equatorial)
    | 'galactic_iau';  // galactic frame (l,b)

export type ReferenceDirection =
    | {
    frame: ReferenceFrame;
    raDecDeg: { ra: number; dec: number }; // for icrf-like usage
    unit?: Vec3; // optional cache
}
    | {
    frame: ReferenceFrame;
    lonLatDeg: { lon: number; lat: number }; // for galactic l,b
    unit?: Vec3;
}
    | {
    frame: ReferenceFrame;
    unit: Vec3; // normalized direction vector
};

export type ReferenceMeta = {
    direction: ReferenceDirection;
    // Heliocentric distance in parsecs for physical references (stars, galactic center).
    // Leave undefined for abstract directions/axes.
    distancePc?: number;
    // Legacy distance unit kept only for migration compatibility.
    distanceLy?: number;
    apparentMagnitude?: number; // visible magnitude from Earth; smaller is brighter
    properMotionRaMasYr?: number; // proper motion in right ascension, mas/year
    properMotionDecMasYr?: number; // proper motion in declination, mas/year
    radialVelocityKmS?: number; // line-of-sight velocity, km/s
};

export type StarMeta = ReferenceMeta & {
    constellationId: ConstellationRefId;
};

export type ConstellationBand = 'ecliptic' | 'north' | 'south';
export type ConstellationPolygonEpoch = 'B1875' | 'J2000';
export type ConstellationVertex = {
    raDeg: number;
    decDeg: number;
};
export type ConstellationPolygonLayerId = 'chart' | 'spherical';
export type ConstellationPolygonLayer = {
    polygonEpoch: ConstellationPolygonEpoch;
    polygons: Array<Array<ConstellationVertex>>;
    samplingStepDeg?: number;
};
export type ConstellationMeta = {
    name: string;
    abbr: string;
    band: ConstellationBand;
    boundaryLayers: {
        chart: ConstellationPolygonLayer;
        spherical: ConstellationPolygonLayer & {
            polygonEpoch: 'J2000';
            samplingStepDeg: number;
        };
    };
};

export type ObjMeta =
    | EngineBodyMeta
    | ReferenceMeta
    | StarMeta
    | ConstellationMeta;

/* =============================================================================
   Obj: enforce (kind <-> id) at the type level
   ============================================================================= */

type ObjBase = {
    name: string;
    description?: string;
    emoji: string;
    emojiScale?: number;
    meta?: (ObjMeta & { color?: string }) | { color?: string };
};

export type EngineBodyObj = ObjBase & {
    kind: 'engine_body';
    id: EngineBodyId;     // ✅ cannot be ref:*
};

export type ReferenceObj = ObjBase & {
    kind: 'reference';
    id: `ref:${string}`;  // ✅ cannot be EngineBodyId
};

export type StarObj = ObjBase & {
    kind: 'star';
    id: `ref:${string}`;
    meta: StarMeta & { color?: string };
};

export type PoleObj = ObjBase & {
    kind: 'pole';
    id: `ref:${string}`;
};

export type ConstellationObj = ObjBase & {
    kind: 'constellation';
    id: `ref:${string}`;
    meta: ConstellationMeta & { color?: string };
};

export type Obj = EngineBodyObj | ReferenceObj | StarObj | PoleObj | ConstellationObj;

export function isReferenceLikeKind(kind: ObjKind | null | undefined): kind is 'reference' | 'star' {
    return kind === 'reference' || kind === 'star';
}

/* =============================================================================
   Wheel types + per-type meta
   ============================================================================= */

export type WheelType =
    | 'compass'
    | 'horizon'
    | 'synod'
    | 'bind'
    | 'season'
    | 'nodal'
    | 'plato'
    | 'system'
    | 'galaxy';

export type BindWheelMeta = {
    cycleDuration?: number;
};

export type SystemWheelMeta = {
    projection?: 'polar' | 'equatorial';
    plane?: 'ecliptic' | 'galactic';
};

export type GalaxyWheelMeta = {
    projection?: 'polar' | 'equatorial';
    plane?: 'galactic' | 'sheet';
};

export type WheelMeta<T extends WheelType> =
    T extends 'bind' ? BindWheelMeta :
        T extends 'system' ? SystemWheelMeta :
            T extends 'galaxy' ? GalaxyWheelMeta :
                never;

type RoleCombo<RS, TType extends WheelType> = RS & {
    meta?: WheelMeta<TType>;
};

/* =============================================================================
   Roles + kinds constraints
   ============================================================================= */

export type RoleName = 'looker' | 'focus' | 'target';

export const ROLE_NAMES: RoleName[] = ['looker', 'focus', 'target'];

export const REFERENCES: ObjId[] = [
    'ref:galactic-center',

    'ref:acamar',
    'ref:achernar',
    'ref:acrux',
    'ref:acubens',
    'ref:adhara',
    'ref:alcyone',
    'ref:aldebaran',
    'ref:alderamin',
    'ref:aldhanab',
    'ref:aldulfin',
    'ref:alfard',
    'ref:alfirk',
    'ref:algedi',
    'ref:algieba',
    'ref:algol',
    'ref:algorab',
    'ref:alhena',
    'ref:alioth',
    'ref:aljanah',
    'ref:alkaid',
    'ref:alkes',
    'ref:almach',
    'ref:alnair',
    'ref:alphecca',
    'ref:alpheratz',
    'ref:alpherg',
    'ref:alrescha',
    'ref:alsciaukat',
    'ref:alsephina',
    'ref:altair',
    'ref:ankaa',
    'ref:anser',
    'ref:antares',
    'ref:arcturus',
    'ref:arneb',
    'ref:ascella',
    'ref:asellus-australis',
    'ref:ashlesha',
    'ref:athebyne',
    'ref:atria',
    'ref:avior',
    'ref:babcock-s-star',
    'ref:bellatrix',
    'ref:betelgeuse',
    'ref:bharani',
    'ref:bibha',
    'ref:brachium',
    'ref:bubup',
    'ref:canopus',
    'ref:capella',
    'ref:caph',
    'ref:castor',
    'ref:ceibo',
    'ref:cervantes',
    'ref:chara',
    'ref:cih',
    'ref:citala',
    'ref:cocibolca',
    'ref:cor-caroli',
    'ref:cursa',
    'ref:dabih',
    'ref:dalim',
    'ref:deltoton',
    'ref:deneb',
    'ref:deneb-algedi',
    'ref:deneb-kaitos',
    'ref:denebola',
    'ref:diadem',
    'ref:dschubba',
    'ref:dubhe',
    'ref:elkurud',
    'ref:elnath',
    'ref:eltanin',
    'ref:emiw',
    'ref:enif',
    'ref:errai',
    'ref:fomalhaut',
    'ref:gacrux',
    'ref:gienah',
    'ref:gomeisa',
    'ref:graffias',
    'ref:gudja',
    'ref:hadar',
    'ref:hamal',
    'ref:hoerikwaggo',
    'ref:hunahpu',
    'ref:illyrian',
    'ref:imai',
    'ref:inquill',
    'ref:intan',
    'ref:izar',
    'ref:kaffaljidhma',
    'ref:kamuy',
    'ref:kapteyn-s-star',
    'ref:karaka',
    'ref:kaus-australis',
    'ref:kitalpha',
    'ref:kochab',
    'ref:kornephoros',
    'ref:kraz',
    'ref:la-superba',
    'ref:lacaille-8760',
    'ref:lacaille-9352',
    'ref:lang-exster',
    'ref:lusitania',
    'ref:luyten-s-star',
    'ref:macondo',
    'ref:mago',
    'ref:mahasim',
    'ref:markab',
    'ref:markeb',
    'ref:maru',
    'ref:menkalinan',
    'ref:menkar',
    'ref:meridiana',
    'ref:miaplacidus',
    'ref:mimosa',
    'ref:mintaka',
    'ref:mirach',
    'ref:miram',
    'ref:mirfak',
    'ref:mothallah',
    'ref:muphrid',
    'ref:naos',
    'ref:nenque',
    'ref:nihal',
    'ref:nunki',
    'ref:nusakan',
    'ref:okab',
    'ref:paradys',
    'ref:peacock',
    'ref:phact',
    'ref:pherkad',
    'ref:phyllon-kissinou',
    'ref:pipit',
    'ref:poerava',
    'ref:polaris',
    'ref:polaris-australis',
    'ref:polis',
    'ref:pollux',
    'ref:porrima',
    'ref:praecipua',
    'ref:procyon',
    'ref:rasalgethi',
    'ref:rasalhague',
    'ref:rastaban',
    'ref:red-rectangle',
    'ref:regulus',
    'ref:rhombus',
    'ref:rigel',
    'ref:rigil-kentaurus',
    'ref:rotanev',
    'ref:sabik',
    'ref:sadalmelik',
    'ref:sadalsuud',
    'ref:sadr',
    'ref:samaya',
    'ref:sargas',
    'ref:sarin',
    'ref:scheat',
    'ref:schedar',
    'ref:sham',
    'ref:shaula',
    'ref:sheliak',
    'ref:sheratan',
    'ref:sirius',
    'ref:skat',
    'ref:spica',
    'ref:stellio',
    'ref:stribor',
    'ref:sualocin',
    'ref:suhail',
    'ref:sulafat',
    'ref:tarazed',
    'ref:tarf',
    'ref:tengshe',
    'ref:tiaki',
    'ref:toliman',
    'ref:tonatiuh',
    'ref:torcular',
    'ref:tupi',
    'ref:tureis',
    'ref:ukdah',
    'ref:unukalhai',
    'ref:uridim',
    'ref:uruk',
    'ref:uuba',
    'ref:vega',
    'ref:vindemiatrix',
    'ref:wazn',
    'ref:wezen',
    'ref:wurren',
    'ref:xami',
    'ref:yed-prior',
    'ref:zhou',
    'ref:zuben-elakrab',
    'ref:zuben-elschemali',
    'ref:zubenelgenubi',
];

/**
 * REQUIRED ROLES (new model):
 * key = role name
 * value = allowed ObjKind(s) for that role
 *
 * If a role key exists here => it is required.
 */
export type RequiredRoles<RS> = Readonly<Partial<Record<keyof RS & RoleName, readonly ObjKind[]>>>;

/* =============================================================================
   UI placement typing
   ============================================================================= */

// "E", "ENE", ..., "E_next"
export type SpokeCode = typeof SPOKES_ORDER[number];

export type EmojiPlacement =
    | 'center'
    | 'pointer'
    | SpokeCode
    | `${SpokeCode}-spoke`;

export type EmojiPlacementInput = EmojiPlacement | readonly EmojiPlacement[];

export type WheelUI<RS> = Partial<Record<keyof RS & RoleName, EmojiPlacementInput>>;

export type WheelNodeGroup = 'synod' | 'bind' | 'horizon' | 'nodal' | 'compass';
export type WheelNodeGroups = Partial<Record<WheelNodeGroup, string[]>>;
export type WheelHouseType = WheelNodeGroup;
export type CompassMainCycle = 'horizon';
export type SystemMainCycle = 'synod' | 'bind' | 'nodal';
export type WheelVisualSide = 'top' | 'side';
export type WheelVisualSupport = {
    primary: WheelVisualSide;
    secondary?: WheelVisualSide;
};

/* =============================================================================
   Role values/selects
   ============================================================================= */

export type RoleValues = {
    looker: ObjId | null;
    focus: ObjId | null;
    target: ObjId[];
};

export type RoleSelects = {
    looker: ObjId[];
    focus: ObjId[];
    target: ObjId[];
};

/* =============================================================================
   Role sets per wheel type
   ============================================================================= */

type RoleSetOf<Allowed extends RoleName> = Partial<Record<Allowed, ObjId[]>>;
type RequireRoles<T, K extends keyof T> = T & { [P in K]-?: NonNullable<T[P]> };

export type CompassRoleSet = RequireRoles<RoleSetOf<'looker' | 'target'>, 'looker' | 'target'>;
export type HorizonRoleSet = RequireRoles<RoleSetOf<'looker' | 'target'>, 'looker' | 'target'>;
export type SynodRoleSet   = RequireRoles<RoleSetOf<'looker' | 'focus' | 'target'>, 'looker' | 'focus' | 'target'>;
export type NodalRoleSet   = RequireRoles<RoleSetOf<'looker' | 'focus' | 'target'>, 'looker' | 'focus' | 'target'>;
export type BindRoleSet    = RequireRoles<RoleSetOf<'focus' | 'target'>, 'focus' | 'target'>;
export type SeasonRoleSet  = RequireRoles<RoleSetOf<'focus' | 'target'>, 'focus' | 'target'>;
export type PlatoRoleSet   = RequireRoles<RoleSetOf<'looker' | 'target'>, 'looker' | 'target'>;
export type SystemRoleSet  = RequireRoles<RoleSetOf<'looker' | 'focus' | 'target'>, 'looker' | 'focus' | 'target'>;
export type GalaxyRoleSet  = RequireRoles<RoleSetOf<'looker' | 'focus' | 'target'>, 'looker' | 'focus' | 'target'>;

/* =============================================================================
   Wheel spec typing
   ============================================================================= */

type WheelSpecBase<TType extends WheelType, RS, MT extends boolean = false> = {
    type: TType;
    ready?: boolean;
    ui?: WheelUI<RS>;
    info?: InfoItem[];

    // combos
    roles: RoleCombo<RS, TType>[];

    // required roles + allowed kinds (single source of truth)
    requiredRoles: RequiredRoles<RS>;
} & (MT extends true ? { multiTarget: true } : {});

type CompassWheelSpec = WheelSpecBase<'compass', CompassRoleSet, true> & {
    nodes?: WheelNodeGroups;
    mainCycle: CompassMainCycle;
    houseType: WheelHouseType;
    visuals?: WheelVisualSupport;
};

type SystemWheelSpec = WheelSpecBase<'system', SystemRoleSet, true> & {
    nodes?: WheelNodeGroups;
    mainCycle: SystemMainCycle;
    houseType: WheelHouseType;
    visuals?: WheelVisualSupport;
};

/* =============================================================================
   WheelSpec union
   ============================================================================= */

export type WheelSpec =
    | CompassWheelSpec
    | WheelSpecBase<'horizon', HorizonRoleSet>
    | WheelSpecBase<'synod', SynodRoleSet>
    | WheelSpecBase<'bind', BindRoleSet>
    | WheelSpecBase<'season', SeasonRoleSet>
    | WheelSpecBase<'nodal', NodalRoleSet>
    | WheelSpecBase<'plato', PlatoRoleSet>
    | SystemWheelSpec
    | WheelSpecBase<'galaxy', GalaxyRoleSet, true>;


export function hmsToDeg(h: number, m: number, s: number): number {
    return (h + m / 60 + s / 3600) * 15;
}

export function dmsToDeg(sign: 1 | -1, d: number, m: number, s: number): number {
    return sign * (d + m / 60 + s / 3600);
}

export function objectLabel(id: ObjId): string {
    const b = (objects as any)[id];
    return b?.name ?? String(id);
}

export function formatRoleValue(v: ObjId | null | ObjId[] | undefined): string {
    if (!v) return '—';

    if (Array.isArray(v)) {
        if (v.length === 0) return '—';
        return v.map(id => objectLabel(id)).join(', ');
    }

    return objectLabel(v);
}

export function formatTargetValue(v: ObjId | null | ObjId[] | undefined): string {
    if (!v) return '—';

    if (Array.isArray(v)) {
        const n = v.length;
        if (n === 0) return '—';
        if (n === 1) return objectLabel(v[0]);
        return `${n} Targets`;
    }

    return objectLabel(v);
}
