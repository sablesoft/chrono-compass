import { writable } from 'svelte/store';

type PhoneCarouselState = {
    enabled: boolean;
    index: number;
    total: number;
    commandSeq: number;
    commandStep: -1 | 1 | 0;
};

const initialState: PhoneCarouselState = {
    enabled: false,
    index: 0,
    total: 0,
    commandSeq: 0,
    commandStep: 0
};

const state = writable<PhoneCarouselState>(initialState);

export const phoneCarouselState = state;

export function syncPhoneCarousel(enabled: boolean, index: number, total: number): void {
    const safeTotal = Number.isFinite(total) ? Math.max(0, Math.trunc(total)) : 0;
    const safeIndex = safeTotal > 0 && Number.isFinite(index)
        ? Math.max(0, Math.min(Math.trunc(index), safeTotal - 1))
        : 0;

    state.update((s) => {
        if (s.enabled === enabled && s.index === safeIndex && s.total === safeTotal) return s;
        return { ...s, enabled, index: safeIndex, total: safeTotal };
    });
}

export function requestPhoneCarouselStep(step: number): void {
    if (!Number.isFinite(step) || step === 0) return;
    const safeStep: -1 | 1 = step < 0 ? -1 : 1;

    state.update((s) => ({
        ...s,
        commandSeq: s.commandSeq + 1,
        commandStep: safeStep
    }));
}
