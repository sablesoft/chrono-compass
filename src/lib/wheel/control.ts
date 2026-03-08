// src/lib/wheel/control.ts
import {formatRoleValue, formatTargetValue, type ObjId, type RoleName, type WheelSpec} from '../catalog';

export type WheelRolesState = Partial<Record<RoleName, ObjId | null | ObjId[]>>;
export const WHEEL_LOADING_OVERLAY_DELAY_MS = 300;

const ROLE_ORDER: RoleName[] = ['looker', 'focus', 'target'];

/**
 * Можно и так:
 *   return (spec as any)?.multiTarget === true;
 * Но лучше без any: проверяем наличие поля.
 */
export function isMultiTarget(spec: WheelSpec): boolean {
    return 'multiTarget' in (spec as any) && (spec as any).multiTarget === true;
}

export function hasRoleValue(spec: WheelSpec, role: RoleName, v: unknown): boolean {
    if (role !== 'target' || !isMultiTarget(spec)) return !!v;
    return Array.isArray(v) && v.length > 0;
}

export function rolesUsedBySpec(spec: WheelSpec): RoleName[] {
    const used = new Set<RoleName>();
    for (const rs of spec.roles) {
        for (const k of Object.keys(rs) as RoleName[]) used.add(k);
    }
    return ROLE_ORDER.filter(r => used.has(r));
}

function roleArray(rs: any, role: RoleName): ObjId[] {
    const a = rs?.[role] as ObjId[] | undefined;
    return Array.isArray(a) ? a : [];
}

function roleValueToArray(spec: WheelSpec, role: RoleName, v: WheelRolesState[RoleName]): ObjId[] {
    if (!v) return [];
    if (Array.isArray(v)) return v as ObjId[];
    return [v as ObjId];
}

/**
 * Проверка: выбранное значение(я) совместимы с конкретным RoleSet.
 * - Для обычных ролей: одно значение должно входить в allowed[]
 * - Для multi-target target: все выбранные должны входить в allowed[]
 */
function roleAllowedBySet(spec: WheelSpec, rs: any, role: RoleName, value: WheelRolesState[RoleName]): boolean {
    const allowed = roleArray(rs, role);
    if (allowed.length === 0) return false;

    if (role === 'target' && isMultiTarget(spec)) {
        const arr = roleValueToArray(spec, role, value);
        if (arr.length === 0) return false;
        return arr.every(id => allowed.includes(id));
    }

    // обычный случай: требуется один ObjId
    if (!value || Array.isArray(value)) return false;
    return allowed.includes(value as ObjId);
}

export function isCompatible(spec: WheelSpec, roles: WheelRolesState): boolean {
    const used = rolesUsedBySpec(spec);

    return spec.roles.some(rs => {
        for (const r of used) {
            const v = roles[r];
            if (!v) return false; // если роль нужна — она должна быть заполнена
            if (!roleAllowedBySet(spec, rs, r, v)) return false;
        }
        return true;
    });
}

/**
 * Возвращает список вариантов для селекта роли так, чтобы:
 * - кандидат должен быть разрешён в каком-то RoleSet
 * - и при этом должен существовать хотя бы один RoleSet, совместимый с текущими выборами в остальных ролях
 *
 * Для multi-target target:
 * - опции для target фильтруются по looker/focus (и т.п.)
 * - но НЕ по текущему target (иначе не сможешь “добавлять/снимать”)
 */
export function optionsForRole(spec: WheelSpec, role: RoleName, roles: WheelRolesState): ObjId[] {
    const used = rolesUsedBySpec(spec);
    if (!used.includes(role)) return [];

    // все кандидаты по этой роли из всех RoleSet
    const all = new Set<ObjId>();
    const allOrdered: ObjId[] = [];
    for (const rs of spec.roles) {
        for (const b of roleArray(rs, role)) {
            if (!all.has(b)) allOrdered.push(b);
            all.add(b);
        }
    }

    const filtered: ObjId[] = [];

    for (const candidate of all) {
        const ok = spec.roles.some(rs => {
            // кандидат должен входить в allowed для этой роли в данном roleset
            if (!roleArray(rs, role).includes(candidate)) return false;

            // остальные выбранные роли должны быть совместимы с этим roleset
            for (const r of used) {
                if (r === role) continue;

                const v = roles[r];
                if (!v) continue;

                // special: если мы подбираем target в multiTarget-режиме,
                // то текущий target НЕ используем как ограничение (чтобы можно было менять выбор).
                if (role === 'target' && isMultiTarget(spec)) {
                    // здесь r может быть looker/focus — ок, их проверяем как обычно
                    // (а target не попадёт сюда потому что r !== role)
                }

                const allowed = roleArray(rs, r);

                if (Array.isArray(v)) {
                    // массив возможен только для target; если внезапно массив в другой роли — считаем несовместимым
                    if (!(r === 'target' && isMultiTarget(spec))) return false;
                    const arr = v as ObjId[];
                    // Empty multi-target should not constrain other roles.
                    if (arr.length === 0) continue;
                    if (!arr.every(id => allowed.includes(id))) return false;
                } else {
                    if (!allowed.includes(v as ObjId)) return false;
                }
            }

            return true;
        });

        if (ok) filtered.push(candidate);
    }

    // стабильный порядок: по первому появлению в spec.roles
    const order: ObjId[] = [];
    const seen = new Set<ObjId>();
    for (const rs of spec.roles) {
        for (const b of roleArray(rs, role)) {
            if (!seen.has(b) && filtered.includes(b)) {
                seen.add(b);
                order.push(b);
            }
        }
    }

    // If current draft is incompatible and filtering produced no options,
    // keep all role candidates visible so user can recover.
    return order.length > 0 ? order : allOrdered;
}

export function normalizeRolesForType(spec: WheelSpec, roles: WheelRolesState): WheelRolesState {
    const used = rolesUsedBySpec(spec);
    const next: WheelRolesState = { ...roles };

    for (const r of used) {
        const v = next[r];
        if (!v) continue;

        const opts = optionsForRole(spec, r, next);

        if (r === 'target' && isMultiTarget(spec)) {
            const arr = Array.isArray(v) ? (v as ObjId[]) : [];
            next[r] = arr.filter(id => opts.includes(id)); // может стать []
            continue;
        }

        if (Array.isArray(v)) {
            // на всякий случай: массив в не-target роли — сбрасываем
            next[r] = null;
            continue;
        }

        if (!opts.includes(v as ObjId)) next[r] = null;
    }

    return next;
}

function ucFirst(s: string) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export function typeLabel(type: string): string {
    return type
        .split(/[-_]+/)
        .filter(Boolean)
        .map(ucFirst)
        .join(' ');
}

export function formatWheelSpec(type: string, roles: WheelRolesState): string {
    const t = typeLabel(type);

    const looker = roles.looker ?? null;
    const focus = roles.focus ?? null;
    const target = roles.target ?? null;

    const L = looker ? formatRoleValue(looker) : null;
    const F = focus ? formatRoleValue(focus) : null;
    const T = target ? formatTargetValue(target) : null;

    // 1) looker + focus + target
    if (L && F && T) {
        return `${L} ${t}: ${F} - ${T}`;
    }
    // 2) looker + target
    if (L && T) {
        return `${L} ${t}: ${T}`;
    }
    // 3) focus + target
    if (F && T) {
        return `${F} ${t}: ${T}`;
    }
    // fallback (на случай неполной конфигурации)
    if (L) return `${L} ${t}`;
    if (F) return `${F} ${t}`;
    return t;
}

function equalBodyIdArrays(a: ObjId[] | null, b: ObjId[] | null): boolean {
    const aa = a ?? [];
    const bb = b ?? [];
    if (aa.length !== bb.length) return false;
    for (let i = 0; i < aa.length; i++) if (aa[i] !== bb[i]) return false;
    return true;
}

export function shallowEqualRoles(a: WheelRolesState, b: WheelRolesState): boolean {
    const aTarget = a.target ?? null;
    const bTarget = b.target ?? null;

    const targetEq = (Array.isArray(aTarget) || Array.isArray(bTarget))
        ? equalBodyIdArrays(Array.isArray(aTarget) ? aTarget : null, Array.isArray(bTarget) ? bTarget : null)
        : (aTarget ?? null) === (bTarget ?? null);

    return (a.looker ?? null) === (b.looker ?? null)
        && (a.focus ?? null) === (b.focus ?? null)
        && targetEq;
}
