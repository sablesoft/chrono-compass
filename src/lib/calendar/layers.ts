import { seasonEvents } from './seasonEvents';
import { bindEvents } from './bindEvents';
import { lunarEvents } from './lunarEvents';
import type { CalendarEvent } from './events';

export type EventCorner = 'top-left' | 'top-right' | 'bottom-right';
export type LayerEvent = CalendarEvent & { layerId: string; corner: EventCorner };
export type CalendarLayer = {
  id: string; label: string; storageKey: string; description: string;
  corner: EventCorner; supportedYears: [number, number];
  resolve: typeof seasonEvents;
};

/** Add wheel layers here: options, evaluation, status and marker placement are derived. */
export const CALENDAR_LAYERS: readonly CalendarLayer[] = [
  {id: 'season', label: 'Season events', storageKey: 'chrono-calendar-seasons', description: 'Season · Sun / Earth · approximate', corner: 'top-right', supportedYears: [1001, 2999], resolve: seasonEvents},
  {id: 'bind', label: 'Sun Bind: Earth', storageKey: 'chrono-calendar-bind', description: 'Sun Bind: Earth · calculated', corner: 'bottom-right', supportedYears: [1001, 2999], resolve: bindEvents},
  {id: 'lunar', label: 'Lunar phases', storageKey: 'chrono-calendar-lunar', description: 'Lunar phases · Synod · calculated', corner: 'top-left', supportedYears: [1001, 2999], resolve: lunarEvents}
];
export const DISPLAY_OPTIONS = [
  {value: 'gregorian', label: 'Gregorian dates', storageKey: 'chrono-calendar-gregorian'},
  {value: 'chakras', label: 'Chakras', storageKey: 'chrono-calendar-chakras'},
  {value: 'dreamspell', label: 'Dreamspell Names', storageKey: 'chrono-calendar-dreamspell'},
  ...CALENDAR_LAYERS.map(layer => ({value: layer.id, label: layer.label, storageKey: layer.storageKey}))
];
export const GREGORIAN_DISPLAY_OPTIONS = [
  {value: 'epoch', label: 'Epoch dates', storageKey: 'chrono-gregorian-epoch'},
  ...CALENDAR_LAYERS.map(layer => ({value: layer.id, label: layer.label, storageKey: layer.storageKey}))
];
export const EVENT_CORNERS: readonly EventCorner[] = ['top-left', 'top-right', 'bottom-right'];

export function readDisplayOptions(storage: Pick<Storage, 'getItem'>, options = DISPLAY_OPTIONS): string[] {
  return options.filter(option => storage.getItem(option.storageKey) === 'true').map(option => option.value);
}
export function saveDisplayOptions(storage: Pick<Storage, 'setItem'>, selected: string[], options = DISPLAY_OPTIONS): void {
  for (const option of options) storage.setItem(option.storageKey, String(selected.includes(option.value)));
}
export function resolveCalendarLayers(selected: string[], start: number, end: number, epoch: number, timezone: string) {
  const layers = CALENDAR_LAYERS.filter(layer => selected.includes(layer.id)).map(layer => ({
    ...layer, ...layer.resolve(start, end, epoch, timezone)
  }));
  const events: LayerEvent[] = layers.flatMap(layer => layer.events.map(event => ({...event, layerId: layer.id, corner: layer.corner})));
  events.sort((a, b) => a.ts - b.ts);
  return {layers, events};
}
