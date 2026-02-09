// src/lib/wheel/pointerAnimator.ts

export type PointerAnimState = {
    angleDeg: number;        // can be unwrapped while animating
    noTransition: boolean;   // set true for 2 RAFs when we do an invisible reset
    isAnimating: boolean;
};

export type PointerAnimInput = {
    baseAngleDeg: number;        // from computeAngle(kind, ts, anchors)
    timeDir: -1 | 0 | 1;         // +1 forward, -1 backward
    cycleKey: string;            // `${anchors.E}:${anchors.E_next}` (or similar)
};

export type PointerAnimCommand =
    | { kind: 'sync' }
    | { kind: 'fullTurn'; dir: -1 | 1; landAngleDeg: number; onDoneResetTo?: number };

export class PointerAnimator {
    private state: PointerAnimState = { angleDeg: 0, noTransition: false, isAnimating: false };
    private lastCycleKey = '';
    private lastBase = 0;

    private needsWrapFix = false;

    // anti-race token
    private runId = 0;

    get(): PointerAnimState {
        return { ...this.state };
    }

    applyInput(input: PointerAnimInput) {
        const { baseAngleDeg, timeDir, cycleKey } = input;

        const prev = this.lastCycleKey;
        const cycleChanged = cycleKey !== prev && prev !== '';
        this.lastCycleKey = cycleKey;

        if (!this.state.isAnimating) {
            const next = this.normalizeByDirection(baseAngleDeg, this.state.angleDeg, timeDir);
            this.state.angleDeg = next;
            this.lastBase = baseAngleDeg;

            if (Math.abs(this.state.angleDeg) > 2000) this.needsWrapFix = true;
            if (cycleChanged) this.needsWrapFix = true;
        }
    }

    play(
        cmd: PointerAnimCommand,
        animMs: number,
        raf: (cb: () => void) => number,
        done: () => void
    ) {
        const myRun = ++this.runId;

        if (cmd.kind === 'sync') {
            this.wrapFix(raf);
            done();
            return;
        }

        if (cmd.kind === 'fullTurn') {
            const turn = -360 * cmd.dir;

            // ВАЖНО: не нормализуем посадку относительно гигантского числа
            const current = this.wrapTo360Like(this.state.angleDeg);

            // Сделать landing "рядом" с текущим локальным углом
            const land = this.normalizeNearest(cmd.landAngleDeg, current);

            // Цель: ровно один оборот + посадка
            const target = land + turn;

            this.state.isAnimating = true;
            this.state.noTransition = false;

            // Теперь анимируем от текущего (реального) state.angleDeg к target,
            // но чтобы CSS не думал, что старт = 2000deg, мы "подправим" старт без скачка:
            // 1) мгновенно (без transition) привести state.angleDeg к current
            // 2) на следующем кадре включить transition и поставить target

            this.state.noTransition = true;
            this.state.angleDeg = current;

            raf(() => {
                raf(() => {
                    if (this.runId !== myRun) return;

                    this.state.noTransition = false;
                    this.state.angleDeg = target;

                    // дальше твой таймер как был
                    const resetTo = cmd.onDoneResetTo;

                    window.setTimeout(() => {
                        if (this.runId !== myRun) return;

                        this.state.isAnimating = false;

                        if (typeof resetTo === 'number') {
                            this.state.noTransition = true;
                            raf(() => raf(() => {
                                if (this.runId !== myRun) return;
                                this.state.angleDeg = resetTo;
                                raf(() => raf(() => {
                                    if (this.runId !== myRun) return;
                                    this.state.noTransition = false;
                                    this.needsWrapFix = false;
                                    done();
                                }));
                            }));
                            return;
                        }

                        if (this.needsWrapFix) {
                            this.wrapFix(raf);
                            this.needsWrapFix = false;
                        }
                        done();
                    }, animMs + 20);
                });
            });

            return;
        }
    }

    private normalizeNearest(baseAngle: number, current: number) {
        let t = baseAngle;
        while (t - current > 180) t -= 360;
        while (t - current < -180) t += 360;
        return t;
    }

    private normalizeByDirection(baseAngle: number, current: number, dir: -1 | 0 | 1) {
        let t = this.normalizeNearest(baseAngle, current);
        if (dir === 0) return t;

        const wantSign = dir > 0 ? -1 : 1; // forward => CCW => negative delta
        const delta = t - current;

        if (Math.abs(delta) > 1e-9 && Math.sign(delta) !== wantSign) {
            t += 360 * wantSign;
        }
        return t;
    }

    private wrapFix(raf: (cb: () => void) => number) {
        const wrapped = this.wrapTo360Like(this.state.angleDeg);
        if (Math.abs(wrapped - this.state.angleDeg) < 1e-6) return;

        this.state.noTransition = true;
        this.state.angleDeg = wrapped;

        raf(() => raf(() => {
            this.state.noTransition = false;
        }));
    }

    private wrapTo360Like(a: number) {
        let x = a;
        while (x > 360) x -= 360;
        while (x < -360) x += 360;
        return x;
    }
}