// src/catalog/index.ts
export { bodies } from './bodies';
export { wheels } from './wheels';

export * from './types';

import type {BodyId, RoleName, RoleSelects, RoleValues, WheelSpec} from "./types";

export function filteredRoles(
    spec: WheelSpec,
    values: RoleValues
): { selects: RoleSelects; values: RoleValues } {

    const used = spec.requiredRoles;
    const multiTarget = (spec as any).multiTarget === true;

    const selects: RoleSelects = {
        looker: [],
        focus: [],
        target: []
    };

    for (const rs of spec.roles) {

        let match = true;

        for (const role of used) {
            const v = values[role];

            if (!v || (Array.isArray(v) && v.length === 0)) continue;

            const allowed =
                (rs as Record<RoleName, BodyId[] | undefined>)[role] ?? [];

            if (role === 'target' && multiTarget) {
                const arr = v as BodyId[];
                if (!arr.every(id => allowed.includes(id))) {
                    match = false;
                    break;
                }
            } else {
                if (!allowed.includes(v as BodyId)) {
                    match = false;
                    break;
                }
            }
        }

        if (!match) continue;

        for (const role of used) {
            const arr =
                (rs as Record<RoleName, BodyId[] | undefined>)[role] ?? [];

            for (const id of arr) {
                if (!selects[role].includes(id)) {
                    selects[role].push(id);
                }
            }
        }
    }

    const nextValues: RoleValues = { ...values };

    for (const role of used) {
        const arr = selects[role];

        if (arr.length === 1) {
            if (role === 'target' && multiTarget) {
                nextValues.target = [arr[0]];
            } else if (role === 'looker') {
                nextValues.looker = arr[0];
            } else if (role === 'focus') {
                nextValues.focus = arr[0];
            }
        }
    }

    return { selects, values: nextValues };
}
