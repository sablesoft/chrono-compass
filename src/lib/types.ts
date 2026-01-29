// src/lib/types.ts
export type CurrentLocation = {
    lat: number;
    lon: number;
    label: string;
};

export type DropdownItem = {
    value: string;          // универсально: и CycleKind, и что угодно строкой
    label: string;
    title?: string;
    disabled?: boolean;
};