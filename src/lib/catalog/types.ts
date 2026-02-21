// src/lib/catalog/types.ts
import { Body as EngineBody } from 'astronomy-engine';
import { SPOKES_ORDER } from '../wheel/types';
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

/* =============================================================================
   Localization + Kind
   ============================================================================= */

export type LocalizedString = {
    en: string;
    ru?: string;
};

export type ObjKind =
    | 'engine_body'     // exists in astronomy-engine (must use EngineBodyId)
    | 'reference';      // everything else (must use ref:*)

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
};

export type ObjMeta =
    | EngineBodyMeta
    | ReferenceMeta;

/* =============================================================================
   Obj: enforce (kind <-> id) at the type level
   ============================================================================= */

type ObjBase = {
    name: LocalizedString;
    emoji: string;
    meta?: ObjMeta;
};

export type EngineBodyObj = ObjBase & {
    kind: 'engine_body';
    id: EngineBodyId;     // ✅ cannot be ref:*
};

export type ReferenceObj = ObjBase & {
    kind: 'reference';
    id: `ref:${string}`;  // ✅ cannot be EngineBodyId
};

export type Obj = EngineBodyObj | ReferenceObj;

/* =============================================================================
   Wheel types + per-type meta
   ============================================================================= */

export type WheelType =
    | 'compass'
    | 'horizon'
    | 'synod'
    | 'bind'
    | 'range'
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

export type WheelUI<RS> = Partial<Record<keyof RS & RoleName, EmojiPlacement>>;

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
export type RangeRoleSet   = RequireRoles<RoleSetOf<'looker' | 'target'>, 'looker' | 'target'>;
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

    // combos
    roles: RoleCombo<RS, TType>[];

    // required roles + allowed kinds (single source of truth)
    requiredRoles: RequiredRoles<RS>;
} & (MT extends true ? { multiTarget: true } : {});

/* =============================================================================
   WheelSpec union
   ============================================================================= */

export type WheelSpec =
    | WheelSpecBase<'compass', CompassRoleSet, true>
    | WheelSpecBase<'horizon', HorizonRoleSet>
    | WheelSpecBase<'synod', SynodRoleSet>
    | WheelSpecBase<'bind', BindRoleSet>
    | WheelSpecBase<'range', RangeRoleSet>
    | WheelSpecBase<'season', SeasonRoleSet>
    | WheelSpecBase<'nodal', NodalRoleSet>
    | WheelSpecBase<'plato', PlatoRoleSet>
    | WheelSpecBase<'system', SystemRoleSet, true>
    | WheelSpecBase<'galaxy', GalaxyRoleSet, true>;


export function hmsToDeg(h: number, m: number, s: number): number {
    return (h + m / 60 + s / 3600) * 15;
}

export function dmsToDeg(sign: 1 | -1, d: number, m: number, s: number): number {
    return sign * (d + m / 60 + s / 3600);
}

export function objectLabel(id: ObjId): string {
    const b = (objects as any)[id];
    return b?.name?.en ?? String(id);
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
