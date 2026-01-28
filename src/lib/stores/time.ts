// src/lib/stores/time.ts
import { writable, get } from 'svelte/store';
import { ms } from '../format';

export const selectedTs = writable<number>(ms(Date.now()));
export const isLive = writable<boolean>(false);

// внутренние таймеры (живут здесь, а не в App)
let liveTimer: ReturnType<typeof setInterval> | null = null;
let liveAlignTimer: ReturnType<typeof setTimeout> | null = null;

function clearLiveTimers() {
    if (liveAlignTimer) { clearTimeout(liveAlignTimer); liveAlignTimer = null; }
    if (liveTimer) { clearInterval(liveTimer); liveTimer = null; }
}

export function stopLive() {
    if (!get(isLive)) return;
    isLive.set(false);
    clearLiveTimers();
}

// “системное” обновление выбранного времени (не выключает live)
// нужно, чтобы live мог писать selectedTs сам
function setSelectedTsSystem(ts: number) {
    selectedTs.set(ms(ts));
}

// “пользовательское” изменение выбранного времени (выключает live)
export function setSelectedTs(ts: number) {
    stopLive();
    selectedTs.set(ms(ts));
}

// удобно вызывать из любых UI действий (колеса, клики, инпуты)
export function onUserActivity() {
    stopLive();
}

export function startLive() {
    if (get(isLive)) return;
    isLive.set(true);

    // сразу ставим актуальное время
    setSelectedTsSystem(Date.now());

    // выравниваемся на следующую границу минуты
    const now = Date.now();
    const msToNextMinute = 60_000 - (now % 60_000);

    clearLiveTimers();

    liveAlignTimer = setTimeout(() => {
        // ровно на границе (с небольшим буфером)
        setSelectedTsSystem(Date.now());

        // дальше — строго каждые 60s
        liveTimer = setInterval(() => {
            setSelectedTsSystem(Date.now());
        }, 60_000);
    }, msToNextMinute + 5);
}

// src/lib/stores/time.ts
export function toggleLive() {
    isLive.update((v) => {
        const next = !v;

        if (next) {
            // включаем live
            selectedTs.set(ms(Date.now()));
            startLive();
        } else {
            // выключаем live: приземлимся на "сейчас", чтобы не было FUTURE из-за дрейфа
            stopLive();
            selectedTs.set(ms(Date.now()));
        }

        return next;
    });
}
