export type CycleKind = 'day' | 'moon' | 'year';

export type SpinCmd = {
    id: number;
    dir: 1 | -1;
    // куда приземлиться после полного оборота
    targetAngleDeg: number;
};