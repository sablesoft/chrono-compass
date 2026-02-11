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

export type RoleName = 'looker' | 'focus' | 'target';

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
    | { type: 'compass'; roles: CompassRoleSet[]; multiTarget: true }
    | { type: 'horizon'; roles: HorizonRoleSet[] }
    | { type: 'synod'; roles: SynodRoleSet[] }
    | { type: 'channel'; roles: ChannelRoleSet[] }
    | { type: 'bind'; roles: BindRoleSet[] }
    | { type: 'range'; roles: RangeRoleSet[] }
    | { type: 'season'; roles: SeasonRoleSet[] }
    | { type: 'nodal'; roles: NodalRoleSet[] }
    | { type: 'plato'; roles: PlatoRoleSet[] };
