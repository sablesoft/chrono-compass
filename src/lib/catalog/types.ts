// src/lib/catalog/types.ts
import { Body as EngineBody } from 'astronomy-engine';

/**
 * BodyId полностью совпадает с id из astronomy-engine
 * Например: 'Earth', 'Moon', 'Sun'
 */
export type BodyId = keyof typeof EngineBody;

export type LocalizedString = {
    en: string;
};

export interface Body {
    /** Must match astronomy-engine Body id */
    id: BodyId;

    /** Localized display name */
    name: LocalizedString;

    /** Default emoji/icon for UI */
    emoji: string;
}

export type WheelType =
    | 'compass'
    | 'horizon'
    | 'synod'
    | 'channel'
    | 'bind'
    | 'range'
    | 'season'
    | 'nodal'
    | 'plato';

export type BindWheelMeta = {
    extrema?: {
        windowMs?: number;
        stepMs?: number;
        maxWindowMs?: number;
        refineIters?: number;
    };
    solve?: {
        maxIters?: number;
        epsMs?: number;
        monoEps?: number;
    };
};

// если потом добавишь другие — допишешь ветки
export type WheelMeta<T extends WheelType> =
    T extends 'bind' ? BindWheelMeta :
        never;

type RoleCombo<RS, TType extends WheelType> = RS & {
    meta?: WheelMeta<TType>;
};

export type RoleName = 'looker' | 'focus' | 'target';

export type RequiredRoles<RS> = readonly (keyof RS & RoleName)[];

type WheelSpecBase<TType extends WheelType, RS, MT extends boolean = false> = {
    type: TType;
    roles: RoleCombo<RS, TType>[];
    requiredRoles: RequiredRoles<RS>;
} & (MT extends true ? { multiTarget: true } : {});

export type RoleValues = {
    looker: BodyId | null;
    focus: BodyId | null;
    target: BodyId[];   // всегда массив, даже если multiTarget=false
};

export type RoleSelects = {
    looker: BodyId[];
    focus: BodyId[];
    target: BodyId[];
};

/** Utility: object with only allowed role keys */
type RoleSetOf<Allowed extends RoleName> = Partial<Record<Allowed, BodyId[]>>;

/** Utility: force some roles to exist (but still arrays) */
type RequireRoles<T, K extends keyof T> = T & { [P in K]-?: NonNullable<T[P]> };

/* ===== Role sets per wheel type ===== */

export type CompassRoleSet = RequireRoles<
    RoleSetOf<'looker' | 'target'>,
    'looker' | 'target'
>;

export type HorizonRoleSet = RequireRoles<
    RoleSetOf<'looker' | 'target'>,
    'looker' | 'target'
>;

export type SynodRoleSet = RequireRoles<
    RoleSetOf<'looker' | 'focus' | 'target'>,
    'looker' | 'focus' | 'target'
>;

export type ChannelRoleSet = RequireRoles<
    RoleSetOf<'looker' | 'focus' | 'target'>,
    'looker' | 'focus' | 'target'
>;

export type NodalRoleSet = RequireRoles<
    RoleSetOf<'looker' | 'focus' | 'target'>,
    'looker' | 'focus' | 'target'
>;

export type BindRoleSet = RequireRoles<
    RoleSetOf<'focus' | 'target'>,
    'focus' | 'target'
>;

export type RangeRoleSet = RequireRoles<
    RoleSetOf<'looker' | 'target'>,
    'looker' | 'target'
>;

export type SeasonRoleSet = RequireRoles<
    RoleSetOf<'focus' | 'target'>,
    'focus' | 'target'
>;

export type PlatoRoleSet = RequireRoles<
    RoleSetOf<'looker' | 'target'>,
    'looker' | 'target'
>;

/* ===== WheelSpec as discriminated union ===== */
export type WheelSpec =
    | WheelSpecBase<'compass', CompassRoleSet, true>
    | WheelSpecBase<'horizon', HorizonRoleSet>
    | WheelSpecBase<'synod', SynodRoleSet>
    | WheelSpecBase<'channel', ChannelRoleSet>
    | WheelSpecBase<'bind', BindRoleSet>
    | WheelSpecBase<'range', RangeRoleSet>
    | WheelSpecBase<'season', SeasonRoleSet>
    | WheelSpecBase<'nodal', NodalRoleSet>
    | WheelSpecBase<'plato', PlatoRoleSet>;
