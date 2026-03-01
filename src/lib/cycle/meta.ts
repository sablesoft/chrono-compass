// src/lib/cycle/meta.ts
import type { CycleKind } from '../stores/cycle';

type CycleMeta = {
    label: string;
    title?: string;
    description?: string;
    order: number;
};

type CycleOption = {
    kind: CycleKind;
    label: string;
    title?: string;
    disabled?: boolean;
};

const CYCLE_META: Record<CycleKind, CycleMeta> = {
    solarTropical:  {
        label: 'Solar Season: Earth',
        description: 'Tropical Year',
        order: 40
    },
    plato: {
        label: 'Galaxy Plato: Earth',
        description: 'Precession Cycle',
        order: 50
    },
};

function getCycleLabel(kind: CycleKind, _locale?: string) {
    // позже тут можно сделать switch по locale / подключить i18n
    return CYCLE_META[kind].label;
}

export function getCycleOptions(kinds?: CycleKind[]): CycleOption[] {
    const list = (kinds ?? (Object.keys(CYCLE_META) as CycleKind[]))
        .slice()
        .sort((a, b) => CYCLE_META[a].order - CYCLE_META[b].order);

    return list.map((kind): CycleOption => ({
        kind,
        label: getCycleLabel(kind),
        title: CYCLE_META[kind].title ?? getCycleLabel(kind),
        // disabled не задаём — он опционален
    }));
}