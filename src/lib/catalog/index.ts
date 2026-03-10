// src/catalog/index.ts
export { objects } from './objects';
export { wheels } from './wheels';

export * from './types';

import {ROLE_NAMES, type ObjId, type RoleName, type RoleSelects, type RoleValues, type WheelSpec} from "./types";

function roleValueArray(role: RoleName, value: ObjId | null | ObjId[] | undefined): ObjId[] {
    if (!value) return [];
    if (Array.isArray(value)) return role === 'target' ? value : [];
    return [value];
}

function idsUsedOutsideRole(values: RoleValues, role: RoleName): Set<ObjId> {
    const out = new Set<ObjId>();
    for (const otherRole of ROLE_NAMES) {
        if (otherRole === role) continue;
        for (const id of roleValueArray(otherRole, values[otherRole])) {
            out.add(id);
        }
    }
    return out;
}

export function filteredRoles(
    spec: WheelSpec,
    values: RoleValues
): { selects: RoleSelects; values: RoleValues } {

    // роли, которые хотим показывать/строить всегда
    const rolesToBuild: RoleName[] = ['looker', 'focus', 'target'];

    const multiTarget = (spec as any).multiTarget === true;

    const selects: RoleSelects = {
        looker: [],
        focus: [],
        target: []
    };

    // helper: проверить совпадение одного roleSpec с текущими values
    function matchesRoleSpec(rs: any): boolean {
        for (const role of rolesToBuild) {
            const v = (values as any)[role];

            // пустое значение не ограничивает
            if (role === 'target') {
                const arr = Array.isArray(v) ? (v as ObjId[]) : (v ? [v as ObjId] : []);
                if (arr.length === 0) continue;

                const allowed = (rs as Record<RoleName, ObjId[] | undefined>)[role] ?? [];

                if (multiTarget) {
                    // все выбранные должны быть разрешены
                    if (!arr.every(id => allowed.includes(id))) return false;
                } else {
                    // single-target: берём первый
                    if (!allowed.includes(arr[0])) return false;
                }
            } else {
                if (!v) continue;
                const allowed = (rs as Record<RoleName, ObjId[] | undefined>)[role] ?? [];
                if (!allowed.includes(v as ObjId)) return false;
            }
        }
        return true;
    }

    // 1) отбираем подходящие roleSpecs
    const matched = spec.roles.filter(matchesRoleSpec);

    // Если вдруг получилось 0 матчей (несовместимая комбинация) —
    // не роняем UI: показываем полный набор опций по спеке.
    const rows = matched.length ? matched : spec.roles;

    // 2) строим selects как union всех allowed значений по rows
    for (const rs of rows) {
        for (const role of rolesToBuild) {
            const arr = (rs as Record<RoleName, ObjId[] | undefined>)[role] ?? [];
            const blocked = idsUsedOutsideRole(values, role);
            for (const id of arr) {
                if (blocked.has(id)) continue;
                if (!selects[role].includes(id)) selects[role].push(id);
            }
        }
    }

    // 3) авто-выбор когда ровно один вариант (опционально)
    const nextValues: RoleValues = { ...values };

    // looker/focus
    for (const role of ['looker', 'focus'] as const) {
        const arr = selects[role];
        // автосет только если роль не задана и доступен один вариант
        if (!nextValues[role] && arr.length === 1) {
            nextValues[role] = arr[0] as any;
        }
    }

    // target
    if (Array.isArray(nextValues.target)) {
        const blocked = idsUsedOutsideRole(nextValues, 'target');
        nextValues.target = nextValues.target.filter((id) => !blocked.has(id) && selects.target.includes(id));
        if (nextValues.target.length === 0 && selects.target.length === 1) {
            nextValues.target = [selects.target[0]] as any;
        }
    }

    for (const role of ['looker', 'focus'] as const) {
        const picked = nextValues[role];
        if (!picked) continue;
        if (!selects[role].includes(picked)) {
            nextValues[role] = null;
        }
    }

    return { selects, values: nextValues };
}

export function requiredRoles(spec: WheelSpec): RoleName[] {
    const rr = spec.requiredRoles;
    if (!rr) return [];

    return ROLE_NAMES.filter(r => r in rr);
}
