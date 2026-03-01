import { wheels } from '../../catalog';
import type { ObjId, RoleName, WheelSpec, WheelType } from '../../catalog';
import type { SavedWheel } from '../../profile/types';
import type { WheelRolesState } from '../control';
import { formatWheelSpec, rolesUsedBySpec } from '../control';

type CatalogCandidate = {
    wheelType: WheelType;
    roles: WheelRolesState;
    title: string;
    key: string;
};

const ROLE_ORDER: RoleName[] = ['looker', 'focus', 'target'];

function roleArray(rs: Partial<Record<RoleName, ObjId[]>>, role: RoleName): ObjId[] {
    const raw = rs[role];
    return Array.isArray(raw) ? raw : [];
}

function roleHasId(roles: WheelRolesState, id: ObjId): boolean {
    for (const role of ROLE_ORDER) {
        const v = roles[role];
        if (!v) continue;
        if (Array.isArray(v)) {
            if (v.includes(id)) return true;
            continue;
        }
        if (v === id) return true;
    }
    return false;
}

function requiredIdsForPair(bodyId: ObjId, pinnedId: ObjId | null): ObjId[] {
    if (!pinnedId || pinnedId === bodyId) return [bodyId];
    return [bodyId, pinnedId];
}

function rolesMatchPair(roles: WheelRolesState, bodyId: ObjId, pinnedId: ObjId | null): boolean {
    const req = requiredIdsForPair(bodyId, pinnedId);
    return req.every((id) => roleHasId(roles, id));
}

function rolesAllowedForId(rs: Partial<Record<RoleName, ObjId[]>>, id: ObjId): RoleName[] {
    const out: RoleName[] = [];
    for (const role of ROLE_ORDER) {
        if (roleArray(rs, role).includes(id)) out.push(role);
    }
    return out;
}

function rolesInSet(rs: Partial<Record<RoleName, ObjId[]>>): RoleName[] {
    return ROLE_ORDER.filter((role) => roleArray(rs, role).length > 0);
}

function isMultiTarget(spec: WheelSpec): boolean {
    return 'multiTarget' in (spec as any) && (spec as any).multiTarget === true;
}

function rolesKey(type: WheelType, roles: WheelRolesState): string {
    const looker = roles.looker ? `L=${roles.looker}` : 'L=';
    const focus = roles.focus ? `F=${roles.focus}` : 'F=';
    const target = Array.isArray(roles.target)
        ? `T=${roles.target.slice().join(',')}`
        : roles.target
            ? `T=${roles.target}`
            : 'T=';
    return `${type}|${looker}|${focus}|${target}`;
}

function buildRolesForRoleSet(
    spec: WheelSpec,
    rs: Partial<Record<RoleName, ObjId[]>>,
    bodyId: ObjId,
    pinnedId: ObjId | null
): WheelRolesState[] {
    const reqIds = requiredIdsForPair(bodyId, pinnedId);
    const usedRoles = rolesInSet(rs);
    if (usedRoles.length === 0) return [];

    const allowMulti = isMultiTarget(spec);
    const scalar: Partial<Record<RoleName, ObjId>> = {};
    const targetSet = new Set<ObjId>();
    const out: WheelRolesState[] = [];
    const dedup = new Set<string>();

    function pushBuilt(): void {
        const roles: WheelRolesState = {};
        for (const role of usedRoles) {
            const allowed = roleArray(rs, role);
            if (allowed.length === 0) return;

            if (role === 'target' && allowMulti) {
                const ids = Array.from(targetSet);
                const finalIds = ids.length > 0 ? ids : [allowed[0]];
                if (!finalIds.every((id) => allowed.includes(id))) return;
                roles.target = finalIds;
                continue;
            }

            const id = scalar[role] ?? allowed[0];
            if (!allowed.includes(id)) return;
            roles[role] = id;
        }

        if (!rolesMatchPair(roles, bodyId, pinnedId)) return;

        const key = rolesKey(spec.type, roles);
        if (dedup.has(key)) return;
        dedup.add(key);
        out.push(roles);
    }

    function assignRequired(idx: number): void {
        if (idx >= reqIds.length) {
            pushBuilt();
            return;
        }

        const id = reqIds[idx];
        const candidates = rolesAllowedForId(rs, id);
        if (candidates.length === 0) return;

        for (const role of candidates) {
            if (role === 'target' && allowMulti) {
                const had = targetSet.has(id);
                targetSet.add(id);
                assignRequired(idx + 1);
                if (!had) targetSet.delete(id);
                continue;
            }

            const prev = scalar[role];
            if (prev && prev !== id) continue;
            scalar[role] = id;
            assignRequired(idx + 1);
            if (prev) scalar[role] = prev;
            else delete scalar[role];
        }
    }

    assignRequired(0);
    return out;
}

export function savedWheelsForPair(
    saved: SavedWheel[],
    bodyId: ObjId,
    pinnedId: ObjId | null
): SavedWheel[] {
    return saved.filter((w) => rolesMatchPair(w.roles, bodyId, pinnedId));
}

export function catalogWheelsForPair(bodyId: ObjId, pinnedId: ObjId | null): CatalogCandidate[] {
    const out: CatalogCandidate[] = [];
    const dedup = new Set<string>();

    for (const type of Object.keys(wheels) as WheelType[]) {
        const spec = wheels[type];
        const used = rolesUsedBySpec(spec);
        if (used.length === 0 || !Array.isArray(spec.roles) || spec.roles.length === 0) continue;

        for (const rs of spec.roles) {
            const combos = buildRolesForRoleSet(spec, rs as Partial<Record<RoleName, ObjId[]>>, bodyId, pinnedId);
            for (const roles of combos) {
                const key = rolesKey(type, roles);
                if (dedup.has(key)) continue;
                dedup.add(key);

                out.push({
                    wheelType: type,
                    roles,
                    title: formatWheelSpec(type, roles),
                    key
                });
            }
        }
    }

    out.sort((a, b) => a.title.localeCompare(b.title));
    return out;
}

