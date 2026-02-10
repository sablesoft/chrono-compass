// src/lib/wheel/pointerAnimator.ts

export type PointerAnimState = {
    angleDeg: number;
    noTransition: boolean;
    isAnimating: boolean;
};

export type PointerAnimInput = {
    baseAngleDeg: number;
    timeDir: -1 | 0 | 1;
    cycleKey: string;
};

export type PointerAnimCommand =
    | { kind: 'sync' }
    | { kind: 'fullTurn'; dir: -1 | 1; landAngleDeg: number; onDoneResetTo?: number };

type Raf = (cb: () => void) => number;
type OnUpdate = (s: PointerAnimState) => void;

export class PointerAnimator {
    private state: PointerAnimState = { angleDeg: 0, noTransition: false, isAnimating: false };
    private lastCycleKey = '';
    private needsWrapFix = false;
    private runId = 0;

    constructor(private onUpdate: OnUpdate = () => {}) {}

    private notify() {
        // важно: отдаём копию, чтобы снаружи не трогали внутренности
        this.onUpdate({ ...this.state });
    }

    get(): PointerAnimState {
        return { ...this.state };
    }

    applyInput(input: PointerAnimInput) {
        const { baseAngleDeg, timeDir, cycleKey } = input;

        const prev = this.lastCycleKey;
        const cycleChanged = cycleKey !== prev && prev !== '';
        this.lastCycleKey = cycleKey;

        if (!this.state.isAnimating) {
            const cur = this.wrapTo360Like(this.state.angleDeg);
            const base = this.wrapTo360Like(baseAngleDeg);

            const next = this.normalizeByDirection(base, cur, timeDir);
            this.state.angleDeg = next;

            if (Math.abs(this.state.angleDeg) > 2000) this.needsWrapFix = true;
            if (cycleChanged) this.needsWrapFix = true;

            this.notify();
        }
    }

    play(cmd: PointerAnimCommand, animMs: number, raf: Raf, done: () => void) {
        const myRun = ++this.runId;

        if (cmd.kind === 'sync') {
            this.wrapFix(raf);
            done();
            return;
        }

        if (cmd.kind !== 'fullTurn') return;

        const turn = -360 * cmd.dir;
        const current = this.wrapTo360Like(this.state.angleDeg);
        const land = this.normalizeNearest(cmd.landAngleDeg, current);
        const target = land + turn;

        this.state.isAnimating = true;

        // Фаза 1: старт без transition
        this.state.noTransition = true;
        this.state.angleDeg = current;
        this.notify();

        // Фаза 2: включить transition (кадр)
        raf(() => {
            if (this.runId !== myRun) return;

            this.state.noTransition = false;
            this.notify();

            // Фаза 3: задать target (кадр)
            raf(() => {
                if (this.runId !== myRun) return;

                this.state.angleDeg = target;
                this.notify();

                const resetTo = cmd.onDoneResetTo;

                window.setTimeout(() => {
                    if (this.runId !== myRun) return;

                    this.state.isAnimating = false;

                    if (typeof resetTo === 'number') {
                        this.state.noTransition = true;
                        this.state.angleDeg = resetTo;
                        this.notify();

                        raf(() => raf(() => {
                            if (this.runId !== myRun) return;
                            this.state.noTransition = false;
                            this.needsWrapFix = false;
                            this.notify();
                            done();
                        }));
                        return;
                    }

                    if (this.needsWrapFix) {
                        this.wrapFix(raf);
                        this.needsWrapFix = false;
                    }

                    this.notify();
                    done();
                }, animMs + 20);
            });
        });
    }

    private normalizeNearest(baseAngle: number, current: number) {
        let t = this.wrapTo360Like(baseAngle);
        const c = this.wrapTo360Like(current);
        while (t - c > 180) t -= 360;
        while (t - c < -180) t += 360;
        return t;
    }

    private normalizeByDirection(baseAngle: number, current: number, dir: -1 | 0 | 1) {
        let t = this.normalizeNearest(baseAngle, current);
        if (dir === 0) return t;

        const wantSign = dir > 0 ? -1 : 1;
        const delta = t - current;

        if (Math.abs(delta) > 1e-9 && Math.sign(delta) !== wantSign) {
            t += 360 * wantSign;
        }
        return t;
    }

    private wrapFix(raf: Raf) {
        const wrapped = this.wrapTo360Like(this.state.angleDeg);
        if (Math.abs(wrapped - this.state.angleDeg) < 1e-6) return;

        this.state.noTransition = true;
        this.state.angleDeg = wrapped;
        this.notify();

        raf(() => raf(() => {
            this.state.noTransition = false;
            this.notify();
        }));
    }

    private wrapTo360Like(a: number) {
        let x = a;
        while (x > 360) x -= 360;
        while (x < -360) x += 360;
        return x;
    }
}