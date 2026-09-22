<script lang="ts">
  import { tick, onMount } from 'svelte';
  import { buildPrintDocument, printText, type PrintLanguage, type FreeDaysOrder } from '../lib/calendar/print';
  import type { CalendarYear } from '../lib/calendar/core';
  export let year: CalendarYear;
  export let epoch: number;
  export let timezone: string;
  export let selected: string[];
  export let language: PrintLanguage;
  export let onClose: () => void;
  let order: FreeDaysOrder = 'end';
  let frame: HTMLIFrameElement;
  let dialog: HTMLDialogElement;
  onMount(() => dialog.showModal());
  let ready = false;
  let error = '';
  $: t = (en: string, ru: string) => printText(language, en, ru);
  $: html = buildPrintDocument({year, epoch, timezone, selected, language, freeDays: order});
  $: if (html) ready = false;
  function loaded() {
    ready = true;
    error = '';
    frame.contentDocument?.addEventListener('keydown', event => {
      if (event.key === 'Escape') onClose();
    });
  }
  async function print() {
    await tick();
    const doc = frame?.contentDocument;
    if (!doc) return;
    await doc.fonts.ready;
    // Refuse overflow instead of silently clipping or changing duplex sheet parity.
    const overflow = [...doc.querySelectorAll<HTMLElement>('.page')].some(page => {
      const bounds = page.getBoundingClientRect();
      const style = getComputedStyle(page);
      const bottom = bounds.bottom - parseFloat(style.paddingBottom);
      const right = bounds.right - parseFloat(style.paddingRight);
      return [...page.querySelectorAll<HTMLElement>('header, .grid, .cover, .legend section, p, li')].some(child => {
        const box = child.getBoundingClientRect();
        return box.bottom > bottom + 1 || box.right > right + 1;
      });
    });
    if (overflow) { error = t('Content exceeds a sheet. Reduce display options before printing.', 'Содержимое выходит за границы листа. Уменьшите число опций отображения перед печатью.'); return; }
    error = '';
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
  }
</script>

<dialog bind:this={dialog} class="preview" on:close={onClose} aria-label={t('Print year preview','Предпросмотр печати года')} tabindex="-1">
  <div class="toolbar">
    <h1>{t('Print / Export year','Печать / Экспорт года')}</h1>
    <label>{t('Language','Язык')} <select bind:value={language}><option value="en">English</option><option value="ru">Русский</option></select></label>
    <label>{t('Free Days','Свободные дни')} <select bind:value={order}><option value="end">{t('At end (default)','В конце (по умолчанию)')}</option><option value="start">{t('At start','В начале')}</option></select></label>
    <button on:click={print} disabled={!ready}>{t('Print / Save as PDF','Печать / Сохранить PDF')}</button>
    <button on:click={onClose}>{t('Close','Закрыть')}</button>
    <p>{t('A4 landscape · 15 sheets / 30 sides · Duplex: flip on long edge. Scale 100%, margins none, browser headers/footers off. Keep blank pages. Test one sheet first.', 'A4 альбомный · 15 листов / 30 сторон · Двусторонняя печать: переворот по длинному краю. Масштаб 100%, без полей и колонтитулов браузера. Сохраняйте пустые страницы. Сначала проверьте один лист.')}</p>
    <p>{t('Binding space: 24 mm at the top of fronts and bottom of backs. Free Days ordering changes sheets only, not dates.', 'Место для колец: 24 мм сверху лицевой стороны и снизу оборота. Порядок Свободных дней меняет только расположение листов, не даты.')}</p>
    {#if error}<p role="alert">{error}</p>{/if}
  </div>
  <iframe bind:this={frame} title={t('Printable year','Год для печати')} srcdoc={html} on:load={loaded}></iframe>
</dialog>
<style>
  .preview { position: fixed; inset: 0; margin: 0; padding: 0; border: 0; width: 100vw; height: 100dvh; max-width: none; max-height: none; z-index: 10000; background: #e1e5eb; color: #17212b; display: flex; flex-direction: column; }
  .toolbar { padding: 12px 20px; display: flex; flex-wrap: wrap; gap: 10px; align-items: center; background: #fff; max-height: 45vh; overflow: auto; }
  h1 { font-size: 20px; margin: 0; } p { flex-basis: 100%; font-size: 13px; margin: 0; } button, select { font: inherit; padding: 8px; border: 1px solid #aab3bf; border-radius: 6px; background: white; color: #17212b; } button { cursor: pointer; } iframe { flex: 1; width: 100%; border: 0; min-height: 0; }
</style>
