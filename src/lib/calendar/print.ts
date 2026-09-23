import { correctionDays, toDay, notation, fromDay, fromGregorianDay, PHRASES, type CalendarYear } from './core';
import { resolveCalendarLayers } from './layers';
import { calendarEventMarker } from './events';
import { DREAMSPELL_TONES, HARMONIC_ACTIONS } from './dreamspell';
import MarkdownIt from 'markdown-it';
import printSupplementEn from '../../../public/docs/en/calendars/harmonic-calendar-print-supplement.md?raw';
import printSupplementRu from '../../../public/docs/ru/calendars/harmonic-calendar-print-supplement.md?raw';

export type PrintLanguage = 'en' | 'ru';
export type FreeDaysOrder = 'end' | 'start' | 'both';
export type PrintAppendix = { title: string; front: string[]; back?: string[] };
export type PrintOptions = { year: CalendarYear; epoch: number; timezone: string; latitude: number; selected: string[]; language: PrintLanguage; freeDays: FreeDaysOrder; appendices?: PrintAppendix[] };
export const printText = (lang: PrintLanguage, en: string, ru: string) => lang === 'ru' ? ru : en;
const escape = (value: unknown) => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]!));
const ruTones = ['Магнитный','Лунный','Электрический','Самосущный','Обертонный','Ритмический','Резонансный','Галактический','Солнечный','Планетарный','Спектральный','Кристаллический','Космический'];
const ruActions = ['Инициировать','Очищать','Преобразовывать','Созревать'];
const ruEvents: Record<string, string[]> = {
  season: ['Мартовское равноденствие','Июньское солнцестояние','Сентябрьское равноденствие','Декабрьское солнцестояние'],
  bind: ['Среднее расстояние Земля–Солнце: удаление','Афелий Земли','Среднее расстояние Земля–Солнце: сближение','Перигелий Земли'],
  lunar: ['Первая четверть Луны','Полнолуние','Последняя четверть Луны','Новолуние']
};

function supplementMarkdown(language: PrintLanguage): string[] {
  const source = language === 'ru' ? printSupplementRu : printSupplementEn;
  const headings = [...source.matchAll(/^##\s+(.+)$/gm)];
  const contentsTitle = language === 'ru' ? 'Содержание' : 'Contents';
  const contents = headings.findIndex(match => match[1].trim() === contentsTitle);
  const firstSection = contents >= 0 ? contents + 1 : 0;
  if (!headings[firstSection]?.index) return [source];
  return [source.slice(0, headings[firstSection].index), ...headings.slice(firstSection).map((match, index) => {
    const end = headings[firstSection + index + 1]?.index ?? source.length;
    return source.slice(match.index, end);
  })].map(fragment => fragment.trim()).filter(Boolean);
}

function renderSupplement(language: PrintLanguage): string {
  const md = new MarkdownIt({html:false,linkify:true,typographer:true});
  const counts = new Map<string, number>();
  const headingOpen = md.renderer.rules.heading_open || ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));
  md.renderer.rules.heading_open = (tokens, idx, options, env, self) => {
    const base = String(tokens[idx + 1]?.content || 'section').normalize('NFKC').toLocaleLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/[\s-]+/g, '-') || 'section';
    const occurrence = counts.get(base) || 0;
    counts.set(base, occurrence + 1);
    tokens[idx].attrSet('id', occurrence ? `${base}-${occurrence + 1}` : base);
    return headingOpen(tokens, idx, options, env, self);
  };
  return `<article class="supplement">${supplementMarkdown(language).map(fragment => `<section class="supplement-section">${md.render(fragment)}</section>`).join('')}</article>`;
}

const supplementPaginationScript = `<script>(() => {
  const paginate = () => {
    const sections = [...document.querySelectorAll('.supplement-section')];
    const probe = document.createElement('div');
    probe.className = 'supplement-measure';
    document.body.append(probe);
    for (const section of sections.slice(0, -1)) {
      probe.innerHTML = section.innerHTML;
      const pages = Math.max(1, Math.round(probe.scrollWidth / probe.clientWidth));
      if (pages % 2 === 1) section.insertAdjacentHTML('afterend', '<section class="supplement-blank" aria-hidden="true"></section>');
    }
    probe.remove();
    document.documentElement.dataset.supplementReady = 'true';
  };
  document.fonts.ready.then(paginate);
})()<\/script>`;

type PrintPeriod = { moon: number; year: CalendarYear; days: Array<{number: number; absolute: number; address: string}> };

function period(year: CalendarYear, moon: number): PrintPeriod {
  return {moon, year, days: Array.from({length: moon === 14 ? correctionDays(year) : 28}, (_, i) => ({
    number: i + 1, absolute: toDay({...year, moon, day: i + 1}), address: notation({...year, moon, day: i + 1})
  }))};
}

function nextYear(year: CalendarYear): CalendarYear {
  const next = fromDay(toDay({...year, moon: 13, day: 28}) + 1);
  return {gc: next.gc, phrase: next.phrase, wave: next.wave, year: next.year};
}

/** End order uses the following year's correction period, preserving civil chronology. */
export function printPeriods(year: CalendarYear, order: FreeDaysOrder) {
  const months = Array.from({length: 13}, (_, i) => period(year, i + 1));
  if (order === 'start') return [period(year, 14), ...months];
  if (order === 'both') return [period(year, 14), ...months, period(nextYear(year), 14)];
  return [...months, period(nextYear(year), 14)];
}

function seasonDescription(direction: string, latitude: number, language: PrintLanguage): string {
  const t = (en: string, ru: string) => printText(language, en, ru);
  const equatorial = Math.abs(latitude) < 0.5;
  const north = latitude >= 0;
  if (direction === 'E') return equatorial
    ? t('Day and night are approximately equal. The Sun crosses the equator northward.', 'День и ночь приблизительно равны. Солнце пересекает экватор в северном направлении.')
    : north ? t('Day and night are equal in length; daylight continues to grow. The Sun crosses the equator northward.', 'День сравнялся по длине с ночью и продолжает расти. Солнце пересекает экватор в северном направлении.')
      : t('Day and night are equal in length; night continues to grow. The Sun crosses the equator northward.', 'День сравнялся по длине с ночью, ночь продолжает расти. Солнце пересекает экватор в северном направлении.');
  if (direction === 'N') return equatorial
    ? t('The North Pole is tilted most directly toward the Sun; the Sun reaches its northernmost declination.', 'Северный полюс максимально направлен к Солнцу; Солнце достигает самого северного склонения.')
    : north ? t('The longest day of the year. The North Pole is tilted most directly toward the Sun.', 'Самый длинный день в году. Северный полюс максимально направлен к Солнцу.')
      : t('The longest night of the year. The North Pole is tilted most directly toward the Sun.', 'Самая долгая ночь в году. Северный полюс максимально направлен к Солнцу.');
  if (direction === 'W') return equatorial
    ? t('Day and night are approximately equal. The Sun crosses the equator southward.', 'День и ночь приблизительно равны. Солнце пересекает экватор в южном направлении.')
    : north ? t('Night and day are equal in length; night continues to grow. The Sun crosses the equator southward.', 'Ночь сравнялась по длине с днём и продолжает расти. Солнце пересекает экватор в южном направлении.')
      : t('Night and day are equal in length; daylight continues to grow. The Sun crosses the equator southward.', 'Ночь сравнялась по длине с днём, день продолжает расти. Солнце пересекает экватор в южном направлении.');
  return equatorial
    ? t('The South Pole is tilted most directly toward the Sun; the Sun reaches its southernmost declination.', 'Южный полюс максимально направлен к Солнцу; Солнце достигает самого южного склонения.')
    : north ? t('The longest night of the year. The South Pole is tilted most directly toward the Sun.', 'Самая долгая ночь в году. Южный полюс максимально направлен к Солнцу.')
      : t('The longest day of the year. The South Pole is tilted most directly toward the Sun.', 'Самый длинный день в году. Южный полюс максимально направлен к Солнцу.');
}

function bindDescription(direction: string, language: PrintLanguage): string {
  const t = (en: string, ru: string) => printText(language, en, ru);
  if (direction === 'E') return t('The Earth–Sun distance reaches the midpoint between its annual minimum and maximum and continues to increase.', 'Расстояние между Землёй и Солнцем достигает середины между годовым минимумом и максимумом и продолжает увеличиваться.');
  if (direction === 'N') return t('The maximum distance between Earth and the Sun.', 'Максимальное расстояние между Землёй и Солнцем.');
  if (direction === 'W') return t('The Earth–Sun distance reaches the midpoint between its annual maximum and minimum and continues to decrease.', 'Расстояние между Землёй и Солнцем достигает середины между годовым максимумом и минимумом и продолжает уменьшаться.');
  return t('The minimum distance between Earth and the Sun.', 'Минимальное расстояние между Землёй и Солнцем.');
}

function freeCircle(days: PrintPeriod['days'], events: ReturnType<typeof resolveCalendarLayers>['events'], civil: (day: number) => string, showGregorian: boolean): string {
  const single = days.length === 1;
  const colors = ['#f6dedd', '#fafafa', '#dde8f7', '#f9eac2'];
  const labels = [{x: 770,y: 500},{x: 500,y: 230},{x: 230,y: 500},{x: 500,y: 770}];
  const sectors = [
    'M 500 500 L 797 203 A 420 420 0 0 1 797 797 Z',
    'M 500 500 L 203 203 A 420 420 0 0 1 797 203 Z',
    'M 500 500 L 203 797 A 420 420 0 0 1 203 203 Z',
    'M 500 500 L 797 797 A 420 420 0 0 1 203 797 Z'
  ];
  const fields = single ? '<circle cx="500" cy="500" r="420" fill="#dff3df" />' : sectors.map((d, i) => `<path d="${d}" fill="${colors[i]}" />`).join('');
  const content = days.map((day, i) => {
    const at = single ? {x:500,y:500} : labels[i];
    const markers = events.filter(event => event.day === day.absolute).map(calendarEventMarker).join(' ');
    return `<g><text class="free-number" x="${at.x}" y="${at.y - (showGregorian ? 12 : 0)}">${single ? 'S' : `S${day.number}`}</text>${showGregorian ? `<text class="free-civil" x="${at.x}" y="${at.y + 48}">${escape(civil(day.absolute))}</text>` : ''}${markers ? `<text class="free-event" x="${at.x}" y="${at.y + (showGregorian ? 90 : 55)}">${escape(markers)}</text>` : ''}</g>`;
  }).join('');
  return `<div class="free-wheel"><svg viewBox="0 0 1000 1000" role="img">${fields}${single ? '' : '<circle cx="500" cy="500" r="435" fill="none" stroke="#dff3df" stroke-width="24" />'}<circle cx="500" cy="500" r="420" fill="none" stroke="#7f8b86" stroke-width="4" />${content}</svg></div>`;
}

/** Standalone HTML isolates paper geometry from the app's responsive layout and theme.
 * Appendices are paired sheets with plain text content, preserving front/back parity.
 */
export function buildPrintDocument(options: PrintOptions): string {
  const {year, epoch, timezone, latitude, selected, language, freeDays} = options;
  const t = (en: string, ru: string) => printText(language, en, ru);
  const has = (id: string) => selected.includes(id);
  const tone = (n: number) => (language === 'ru' ? ruTones : DREAMSPELL_TONES)[n - 1] || '';
  const actions = language === 'ru' ? ruActions : HARMONIC_ACTIONS;
  const yearCoordinate = (value: CalendarYear) => `GC ${value.gc} · A ${value.phrase}(${PHRASES[value.phrase - 1]}) · ${value.wave === 0 ? 'X' : `W ${value.wave}`} · Y ${value.year}`;
  const coordinate = yearCoordinate(year);
  const yearName = has('dreamspell') ? (year.wave ? tone(year.year) : PHRASES[year.phrase - 1] === 4 ? actions[year.year - 1] : '') : '';
  const coverYearName = yearName ? (year.wave ? t(`${yearName} Year`, `Год ${yearName}`) : t(`${yearName} Year`, `Год · ${yearName}`)) : '';
  const civil = (absolute: number) => {
    const d = fromGregorianDay(epoch + absolute);
    return `${d.day}.${String(d.month).padStart(2,'0')}.${d.year <= 0 ? `${1-d.year} ${t('BCE','до н. э.')}` : d.year}`;
  };
  const sheets: string[] = [];
  const page = (content: string, back = false, blank = false) => `<section class="page ${back ? 'back' : 'front'}${blank ? ' blank' : ''}">${content}</section>`;
  const heading = (title: string, value: CalendarYear = year) => `<header><h1>${escape(title)}</h1><p>${escape(yearCoordinate(value))}${value === year && yearName ? ` · ${escape(yearName)}` : ''}</p></header>`;
  sheets.push(page(`<div class="cover"><p>CHRONO COMPASS</p><h1>${t('Harmonic Calendar','Гармоничный Календарь')}</h1><h2>${escape(coordinate)}</h2><p>${escape(coverYearName)}</p><p>${escape(timezone)}</p><p><a href="https://chrono-compass.app">https://chrono-compass.app</a></p></div>`), page('', true, true));
  for (const period of printPeriods(year, freeDays)) {
    const free = period.moon === 14;
    const title = free ? (period.days.length === 1 ? t('Free Day','День Свободы') : t('Free Days','Дни Свободы')) : `${t('Month','Месяц')} ${period.moon}${has('dreamspell') ? ` · ${tone(period.moon)}` : ''}`;
    const data = resolveCalendarLayers(selected, period.days[0].absolute, period.days.at(-1)!.absolute, epoch, timezone);
    const dayName = (n: number) => free ? (period.days.length === 1 ? 'S' : `S${n}`) : String(n);
    const cells = period.days.map(day => `<div class="cell week${free ? day.number - 1 : Math.floor((day.number-1)/7)}"><strong>${dayName(day.number)}</strong>${has('gregorian') ? `<span>${escape(civil(day.absolute))}</span>` : ''}<small>${escape(data.events.filter(e => e.day === day.absolute).map(calendarEventMarker).join(' '))}</small></div>`).join('');
    sheets.push(page(`${heading(title, period.year)}${free ? freeCircle(period.days, data.events, civil, has('gregorian')) : `<div class="grid">${cells}</div>`}`));
    const sections: string[] = [];
    if (free) sections.push(`<section><p>${period.days.length === 1 ? t('A correction day outside the calendar grid. It lies between adjacent calendar years.', 'Корректирующий день вне календарной сетки. Находится между соседними календарными годами.') : t('Correction days outside the calendar grid. They lie between adjacent calendar years.', 'Корректирующие дни вне календарной сетки. Находятся между соседними календарными годами.')}</p></section>`);
    if (has('gregorian')) sections.push(`<section><h2>${t('Gregorian dates','Григорианские даты')}</h2><p>${escape(civil(period.days[0].absolute))} — ${escape(civil(period.days.at(-1)!.absolute))}</p></section>`);
    if (has('dreamspell') && !free) sections.push(`<section><h2>Dreamspell</h2><p>${t('Wave','Волна')}: ${year.wave ? escape(tone(year.wave)) : 'X'} · ${t('Year','Год')}: ${escape(yearName || 'X')}</p><p>${t('Month','Месяц')}: ${escape(tone(period.moon))}</p></section>`);
    for (const layer of data.layers) {
      const label = language === 'ru' ? ({season:'Сезонные события',bind:'Расстояние Земля–Солнце',lunar:'Фазы Луны'}[layer.id] || layer.label) : layer.label;
      const entries = layer.events.map(event => {
        const name = language === 'ru' ? ruEvents[layer.id]?.[['E','N','W','S'].indexOf(event.direction)] || event.label : event.label;
        const n = event.day - period.days[0].absolute + 1;
        const time = new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : 'en-GB', {timeZone:timezone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(event.ts);
        const description = layer.id === 'season' ? seasonDescription(event.direction, latitude, language) : layer.id === 'bind' ? bindDescription(event.direction, language) : '';
        return `<li><div><b>${escape(dayName(n))}</b> · ${escape(calendarEventMarker(event))} ${escape(name)} · ≈ ${time}${has('gregorian') ? ` · ${escape(civil(event.day))}` : ''}</div>${description ? `<div class="event-description">${escape(description)}</div>` : ''}</li>`;
      }).join('');
      sections.push(`<section><h2>${escape(label)}</h2>${!layer.available ? `<p>${t('Unavailable. Supported Gregorian years:','Недоступно. Поддерживаются григорианские годы:')} ${layer.supportedYears.join('–')}.</p>` : entries ? `<ul>${entries}</ul>` : `<p>${t('No events in this period.','В этом периоде нет событий.')}</p>`}</section>`);
    }
    sheets.push(page(`${heading(`${title} · ${t('Legend','Легенда')}`, period.year)}<p class="zone">${escape(timezone)} · ${t('Event times are approximate; lunar times rounded to the nearest minute.','Время событий приблизительное; лунные события округлены до минуты.')}</p><div class="legend">${sections.join('')}</div>`, true));
  }
  for (const appendix of options.appendices || []) {
    const content = (lines: string[]) => `${heading(appendix.title)}${lines.map(line=>`<p>${escape(line)}</p>`).join('')}`;
    sheets.push(page(content(appendix.front)), page(appendix.back ? content(appendix.back) : '', true, !appendix.back));
  }
  return `<!doctype html><html lang="${language}"><head><meta charset="utf-8"><title>${escape(coordinate)} · ${t('Harmonic Calendar','Гармоничный Календарь')}</title><style>
    @page { size: A4 landscape; margin: 0; }
    @page supplement:right { size: A4 landscape; margin: 24mm 12mm 12mm; }
    @page supplement:left { size: A4 landscape; margin: 12mm 12mm 24mm; }
    * { box-sizing: border-box; } body { margin: 0; color: #17212b; background: #d9dde2; font: 11pt Arial, sans-serif; }
    .page { width: 297mm; height: 210mm; padding: 24mm 12mm 12mm; margin: 8mm auto; background: white; break-after: page; page-break-after: always; position: relative; }
    .page.back { padding: 12mm 12mm 24mm; } .page:last-child { break-after: auto; page-break-after: auto; }
    h1 { font-size: 23pt; margin: 0 0 3mm; } h2 { font-size: 12pt; margin: 0 0 2mm; } p { margin: 0 0 3mm; line-height: 1.35; }
    header { height: 25mm; } .grid { display: grid; grid-template-columns: repeat(7,1fr); grid-template-rows: repeat(4,1fr); gap: 2mm; height: 147mm; }
    .cell { border: .3mm solid #8e969e; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2mm; border-radius: 2mm; }
    .cell strong { font-size: 23pt; } .cell small { font-size: 12pt; min-height: 5mm; }
    .week0 { background: #f6dedd; } .week1 { background: #fafafa; } .week2 { background: #dde8f7; } .week3 { background: #f9eac2; }
    .free-wheel { height: 147mm; display: flex; justify-content: center; align-items: center; } .free-wheel svg { width: 145mm; height: 145mm; } .free-wheel text { text-anchor: middle; fill: #17212b; font-family: Arial,sans-serif; } .free-number { font-size: 54px; font-weight: 700; } .free-civil { font-size: 27px; } .free-event { font-size: 34px; }
    .cover { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8mm; } .cover h1 { font-size: 38pt; } .cover a { color: inherit; text-decoration: none; }
    .zone { font-size: 9pt; } .legend { columns: 2; column-gap: 10mm; font-size: 10pt; line-height: 1.35; } .legend section { break-inside: avoid; margin-bottom: 4mm; } ul, ol { margin: 0; padding-left: 5mm; } li { margin-bottom: 2.5mm; } .event-description { margin: .7mm 0 0 7mm; color: #4c5864; font-size: 9pt; }
    .supplement-section { page: supplement; break-before: page; page-break-before: always; font: 10pt Georgia, 'Times New Roman', serif; line-height: 1.35; }
    .supplement-section h1, .supplement-measure h1 { font-size: 26pt; } .supplement-section h2, .supplement-measure h2 { font-size: 21pt; margin: 0 0 5mm; } .supplement-section h3, .supplement-measure h3 { font-size: 14pt; margin: 5mm 0 2mm; }
    .supplement-section h1, .supplement-section h2, .supplement-section h3, .supplement-measure h1, .supplement-measure h2, .supplement-measure h3 { break-after: avoid; }
    .supplement-section p, .supplement-measure p { margin: 0 0 3mm; } .supplement-section ul, .supplement-section ol, .supplement-measure ul, .supplement-measure ol { margin: 0 0 4mm; padding-left: 7mm; }
    .supplement-section li, .supplement-measure li { margin-bottom: 2mm; } .supplement-section table, .supplement-measure table { width: 100%; border-collapse: collapse; margin: 3mm 0 5mm; break-inside: avoid; }
    .supplement-section th, .supplement-section td, .supplement-measure th, .supplement-measure td { border: .25mm solid #8e969e; padding: 1.5mm 2mm; text-align: left; vertical-align: top; }
    .supplement-section pre, .supplement-measure pre { white-space: pre-wrap; break-inside: avoid; font: 8.5pt ui-monospace, SFMono-Regular, Menlo, monospace; }
    .supplement-section a, .supplement-measure a { color: inherit; }
    .supplement-measure { position: absolute; left: -10000mm; top: 0; visibility: hidden; width: 273mm; height: 174mm; columns: 273mm auto; column-gap: 0; column-fill: auto; overflow: visible; font: 10pt Georgia, 'Times New Roman', serif; line-height: 1.35; }
    .supplement-blank { page: supplement; break-before: page; break-after: page; page-break-before: always; page-break-after: always; height: 174mm; }
    @media screen { .supplement-section, .supplement-blank { width: 297mm; min-height: 210mm; margin: 8mm auto; padding: 24mm 12mm 12mm; background: white; } .supplement-blank { padding: 12mm 12mm 24mm; } }
    @media print { html, body { background: white; } .page { margin: 0; print-color-adjust: exact; -webkit-print-color-adjust: exact; } .supplement-section { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
  </style></head><body>${sheets.join('')}${renderSupplement(language)}${supplementPaginationScript}</body></html>`;
}
