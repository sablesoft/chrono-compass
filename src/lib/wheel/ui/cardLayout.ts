import { BOARD_DEFAULT_W, BOARD_GRID_COLUMNS } from '../../board/layoutEngine';

export type InfoPosition = 'bottom' | 'left' | 'right';

export const CARD_VISUAL_COLS_DEFAULT = BOARD_DEFAULT_W;
export const CARD_VISUAL_COLS_MIN = 6;
export const CARD_VISUAL_COLS_MAX = BOARD_GRID_COLUMNS;
export const CARD_INFO_SIDE_COLS_DEFAULT = 10;
export const CARD_INFO_SIDE_COLS_MIN = 4;
export const CARD_INFO_SIDE_COLS_MAX = BOARD_GRID_COLUMNS;
export const CARD_INFO_BOTTOM_HEIGHT_DEFAULT = 420;
export const CARD_INFO_BOTTOM_HEIGHT_MIN = 220;
export const CARD_INFO_BOTTOM_HEIGHT_MAX = 1600;

export function clampCols(value: unknown, fallback: number, min: number, max: number): number {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    return Math.min(max, Math.max(min, Math.round(num)));
}

export function clampBottomHeight(
    value: unknown,
    fallback = CARD_INFO_BOTTOM_HEIGHT_DEFAULT,
    min = CARD_INFO_BOTTOM_HEIGHT_MIN,
    max = CARD_INFO_BOTTOM_HEIGHT_MAX
): number {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    return Math.min(max, Math.max(min, Math.round(num)));
}

export function normalizeInfoPosition(value: unknown, canPlaceSide: boolean): InfoPosition {
    if (!canPlaceSide) return 'bottom';
    if (value === 'left' || value === 'right') return value;
    return 'bottom';
}

export function visualPaneCols(visualCols: number, isDualRow: boolean): number {
    return isDualRow ? Math.max(visualCols, visualCols * 2) : visualCols;
}

export function totalCardCols(position: InfoPosition, visualCols: number, infoSideCols: number, isDualRow: boolean): number {
    const paneCols = visualPaneCols(visualCols, isDualRow);
    return position === 'bottom' ? paneCols : paneCols + infoSideCols;
}

export function resizeColsDelta(deltaPx: number, startPanelWidth: number, startCols: number): number {
    if (!(startPanelWidth > 0) || !(startCols > 0)) return 0;
    const pxPerCol = startPanelWidth / startCols;
    if (!(pxPerCol > 0)) return 0;
    return Math.round(deltaPx / pxPerCol);
}
