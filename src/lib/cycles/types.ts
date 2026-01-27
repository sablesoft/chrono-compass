export type CycleKind = 'day' | 'moon' | 'year' | 'plato';

export type SpinCmd = {
    id: number;
    dir: 1 | -1;
    // куда приземлиться после полного оборота
    targetAngleDeg: number;
};

export type PreTurnCmd = {
    id: number;
    dir: 1 | -1;
};
