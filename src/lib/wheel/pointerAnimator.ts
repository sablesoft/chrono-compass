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

type OnUpdate = (s: PointerAnimState) => void;

export class PointerAnimator {
    private state: PointerAnimState = { angleDeg: 0, noTransition: false, isAnimating: false };
    private lastCycleKey = '';
    private needsWrapFix = false;

    constructor(private onUpdate: OnUpdate = () => {}) {}

    private notify() {
        // важно: отдаём копию, чтобы снаружи не трогали внутренности
        this.onUpdate({ ...this.state });
    }

    applyInput(input: PointerAnimInput) {
        const { baseAngleDeg, timeDir, cycleKey } = input;

        const prev = this.lastCycleKey;
        const cycleChanged = cycleKey !== prev && prev !== '';
        this.lastCycleKey = cycleKey;

        if (!this.state.isAnimating) {
            const cur = this.wrapTo360Like(this.state.angleDeg);
            const base = this.wrapTo360Like(baseAngleDeg);
            // On first frame of a new cycle window, do not force motion direction.
            // This prevents choosing a wrong angle branch right after E+ -> E jump.
            const dirForNormalize: -1 | 0 | 1 = cycleChanged ? 0 : timeDir;
            this.state.angleDeg = this.normalizeByDirection(base, cur, dirForNormalize);

            if (Math.abs(this.state.angleDeg) > 2000) this.needsWrapFix = true;
            if (cycleChanged) this.needsWrapFix = true;

            this.notify();
        }
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

    private wrapTo360Like(a: number) {
        let x = a;
        while (x > 360) x -= 360;
        while (x < -360) x += 360;
        return x;
    }
}
