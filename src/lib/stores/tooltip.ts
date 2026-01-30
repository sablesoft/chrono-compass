import { writable } from 'svelte/store';

export type TooltipPlacement = 'auto' | 'top' | 'right' | 'bottom' | 'left';

export type TooltipMomentItem = {
    id: string;           // baseId или instanceId — что тебе удобнее
    ts: number;           // ts этого маркера/инстанса
    emoji: string;
    title: string;
    description: string;
    collectionId?: string;
    bg?: string;          // цвет точки/коллекции (опционально)
    orbit?: number;       // 0..1 (опционально)
    repeatLabel?: string; // например "(12 months)" — опционально
};

export type TooltipPayload =
    | {
    kind: 'moment';
    title?: string; // общий заголовок (например "3 moments")
    items: TooltipMomentItem[];
}
    | {
    kind: 'spoke' | 'boundary';
    title: string;
    lines?: string[];   // доп. строки описания
    ts?: number;
};

export type TooltipState = {
    open: boolean;
    x: number; // координаты в viewport
    y: number;
    placement: TooltipPlacement;
    payload: TooltipPayload | null;
};

const initial: TooltipState = {
    open: false,
    x: 0,
    y: 0,
    placement: 'auto',
    payload: null
};

export const tooltip = writable<TooltipState>(initial);

export function showTooltip(opts: {
    x: number;
    y: number;
    payload: TooltipPayload;
    placement?: TooltipPlacement;
}) {
    tooltip.set({
        open: true,
        x: opts.x,
        y: opts.y,
        placement: opts.placement ?? 'auto',
        payload: opts.payload
    });
}

export function moveTooltip(x: number, y: number) {
    tooltip.update(s => (s.open ? { ...s, x, y } : s));
}

export function hideTooltip() {
    tooltip.set(initial);
}
