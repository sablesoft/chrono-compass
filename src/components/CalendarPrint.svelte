<script lang="ts">
  import { tick, onMount } from 'svelte';
  import { buildPrintDocument, printDocumentTitle, printText, type PrintLanguage, type FreeDaysOrder } from '../lib/calendar/print';
  import type { CalendarYear } from '../lib/calendar/core';
  export let year: CalendarYear;
  export let epoch: number;
  export let timezone: string;
  export let latitude: number;
  export let selected: string[];
  export let language: PrintLanguage;
  export let onClose: () => void;
  let order: FreeDaysOrder = 'end';
  let frame: HTMLIFrameElement;
  let dialog: HTMLDialogElement;
  let mounted = false;
  let applicationTitle = '';
  const PRINT_LANGUAGE_KEY = 'chrono-print-language';
  onMount(() => {
    applicationTitle = document.title;
    mounted = true;
    try {
      const saved = localStorage.getItem(PRINT_LANGUAGE_KEY);
      if (saved === 'en' || saved === 'ru' || saved === 'pt') language = saved;
    } catch {}
    dialog.showModal();
    return () => {
      mounted = false;
      document.title = applicationTitle;
    };
  });
  let ready = false;
  let error = '';
  $: t = (en: string, ru: string, pt: string) => printText(language, en, ru, pt);
  $: calendarSheetCount = order === 'both' ? 16 : 15;
  $: if (mounted) document.title = printDocumentTitle(year, language);
  $: html = buildPrintDocument({year, epoch, timezone, latitude, selected, language, freeDays: order});
  $: if (html) ready = false;
  async function loaded() {
    await frame.contentDocument?.fonts.ready;
    await tick();
    ready = frame.contentDocument?.documentElement.dataset.supplementReady === 'true';
    error = '';
    frame.contentDocument?.addEventListener('keydown', event => {
      if (event.key === 'Escape') onClose();
    });
  }
  function changeLanguage(event: Event) {
    const value = (event.currentTarget as HTMLSelectElement).value;
    language = value === 'ru' || value === 'pt' ? value : 'en';
    try { localStorage.setItem(PRINT_LANGUAGE_KEY, language); } catch {}
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
    if (overflow) { error = t('Content exceeds a sheet. Reduce display options before printing.', 'Содержимое выходит за границы листа. Уменьшите число опций отображения перед печатью.', 'O conteúdo ultrapassa os limites da folha. Reduza o número de opções de exibição antes de imprimir.'); return; }
    error = '';
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
  }
</script>

<dialog bind:this={dialog} class="preview" on:close={onClose} aria-label={t('Print year preview','Предпросмотр печати года','Pré-visualização da impressão do ano')} tabindex="-1">
  <div class="toolbar">
    <h1>{t('Print / Export year','Печать / Экспорт года','Imprimir / Exportar ano')}</h1>
    <label>{t('Language','Язык','Idioma')} <select value={language} on:change={changeLanguage}><option value="en">English</option><option value="ru">Русский</option><option value="pt">Português</option></select></label>
    <label>{t('Free Days','Дни Свободы','Dias Livres')} <select bind:value={order}><option value="end">{t('At end (default)','В конце (по умолчанию)','No final (padrão)')}</option><option value="start">{t('At start','В начале','No início')}</option><option value="both">{t('At both ends','С обеих сторон','Nos dois extremos')}</option></select></label>
    <button on:click={print} disabled={!ready}>{t('Print / Save as PDF','Печать / Сохранить PDF','Imprimir / Salvar como PDF')}</button>
    <button on:click={onClose}>{t('Close','Закрыть','Fechar')}</button>
    <p>A4 {t('landscape','альбомный','paisagem')} · {calendarSheetCount} {t('calendar sheets plus the guide','листов календаря плюс руководство','folhas do calendário mais o guia')} · {t('Duplex: flip on long edge. Scale 100%, margins none, browser headers/footers off. Preserve blank reverse sides: the cover and every guide section start on the front of a new sheet. Test one sheet first.', 'Двусторонняя печать: переворот по длинному краю. Масштаб 100%, без полей и колонтитулов браузера. Сохраняйте пустые обороты: обложка и каждый раздел руководства начинаются с лицевой стороны нового листа. Сначала проверьте один лист.', 'Impressão frente e verso: virar pela borda longa. Escala de 100%, sem margens nem cabeçalhos ou rodapés do navegador. Preserve os versos em branco: a capa e cada seção do guia começam na frente de uma nova folha. Teste primeiro uma folha.')}</p>
    <p>{t('Binding space: 24 mm at the top of fronts and bottom of backs, including the guide. At end uses the Free Day(s) after Month 13; at start uses those before Month 1; at both ends includes both distinct periods.', 'Место для колец: 24 мм сверху лицевой стороны и снизу оборота, включая руководство. В конце используются Дни Свободы после Месяца 13; в начале — перед Месяцем 1; с обеих сторон — оба разных периода.', 'Espaço para encadernação: 24 mm na parte superior das frentes e na parte inferior dos versos, inclusive no guia. No final usa os Dias Livres após o Mês 13; no início usa os dias anteriores ao Mês 1; nos dois extremos inclui os dois períodos distintos.')}</p>
    {#if error}<p role="alert">{error}</p>{/if}
  </div>
  <iframe bind:this={frame} title={t('Printable year','Год для печати','Ano para impressão')} srcdoc={html} on:load={loaded}></iframe>
</dialog>
<style>
  .preview { position: fixed; inset: 0; margin: 0; padding: 0; border: 0; width: 100vw; height: 100dvh; max-width: none; max-height: none; z-index: 10000; background: #e1e5eb; color: #17212b; display: flex; flex-direction: column; }
  .toolbar { padding: 12px 20px; display: flex; flex-wrap: wrap; gap: 10px; align-items: center; background: #fff; max-height: 45vh; overflow: auto; }
  h1 { font-size: 20px; margin: 0; } p { flex-basis: 100%; font-size: 13px; margin: 0; } button, select { font: inherit; padding: 8px; border: 1px solid #aab3bf; border-radius: 6px; background: white; color: #17212b; } button { cursor: pointer; } iframe { flex: 1; width: 100%; border: 0; min-height: 0; }
</style>
