// src/lib/types.ts
export type DropdownItem = {
    value: string;          // универсально: и CycleKind, и что угодно строкой
    label: string;
    title?: string;
    disabled?: boolean;
};