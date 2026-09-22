import { correctionDays, toDay, notation, fromGregorianDay, PHRASES, type CalendarYear } from './core';
import { resolveCalendarLayers } from './layers';
import { calendarEventMarker } from './events';
import { DREAMSPELL_TONES, HARMONIC_ACTIONS } from './dreamspell';
import { CHAKRAS } from './chakras';

export type PrintLanguage = 'en' | 'ru';
export type FreeDaysOrder = 'end' | 'start';
export type PrintAppendix = { title: string; front: string[]; back?: string[] };
export type PrintOptions = { year: CalendarYear; epoch: number; timezone: string; selected: string[]; language: PrintLanguage; freeDays: FreeDaysOrder; appendices?: PrintAppendix[] };
export const printText = (lang: PrintLanguage, en: string, ru: string) => lang === 'ru' ? ru : en;
const escape = (value: unknown) => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]!));
const ruTones = ['Магнитный','Лунный','Электрический','Самосущный','Обертонный','Ритмический','Резонансный','Галактический','Солнечный','Планетарный','Спектральный','Кристаллический','Космический'];
const ruActions = ['Инициировать','Очищать','Преобразовывать','Созревать'];
const ruChakras = ['Корневая · красный','Сакральная · оранжевый','Солнечное сплетение · жёлтый','Сердечная · зелёный','Горловая · синий','Третий глаз · индиго','Коронная · фиолетовый'];
const ruEvents: Record<string, string[]> = {
  season: ['Мартовское равноденствие','Июньское солнцестояние','Сентябрьское равноденствие','Декабрьское солнцестояние'],
  bind: ['Среднее расстояние Земля–Солнце: удаление','Афелий Земли','Среднее расстояние Земля–Солнце: сближение','Перигелий Земли'],
  lunar: ['Первая четверть Луны','Полнолуние','Последняя четверть Луны','Новолуние']
};

/** Ordering changes paper collation only; correction dates still belong to this year. */
export function printPeriods(year: CalendarYear, order: FreeDaysOrder) {
  const months = Array.from({length: 13}, (_, i) => i + 1);
  return (order === 'start' ? [14, ...months] : [...months, 14]).map(moon => ({
    moon, days: Array.from({length: moon === 14 ? correctionDays(year) : 28}, (_, i) => ({
      number: i + 1, absolute: toDay({...year, moon, day: i + 1}), address: notation({...year, moon, day: i + 1})
    }))
  }));
}

/** Standalone HTML isolates paper geometry from the app's responsive layout and theme.
 * Appendices are paired sheets with plain text content, preserving front/back parity.
 */
export function buildPrintDocument(options: PrintOptions): string {
  const {year, epoch, timezone, selected, language, freeDays} = options;
  const t = (en: string, ru: string) => printText(language, en, ru);
  const has = (id: string) => selected.includes(id);
  const tone = (n: number) => (language === 'ru' ? ruTones : DREAMSPELL_TONES)[n - 1] || '';
  const actions = language === 'ru' ? ruActions : HARMONIC_ACTIONS;
  const coordinate = `GC ${year.gc} · A ${year.phrase}(${PHRASES[year.phrase - 1]}) · ${year.wave === 0 ? 'X' : `W ${year.wave}`} · Y ${year.year}`;
  const yearName = has('dreamspell') ? (year.wave ? tone(year.year) : PHRASES[year.phrase - 1] === 4 ? actions[year.year - 1] : '') : '';
  const civil = (absolute: number) => {
    const d = fromGregorianDay(epoch + absolute);
    return `${d.day}.${String(d.month).padStart(2,'0')}.${d.year <= 0 ? `${1-d.year} ${t('BCE','до н. э.')}` : d.year}`;
  };
  const sheets: string[] = [];
  const page = (content: string, back = false, blank = false) => `<section class="page ${back ? 'back' : 'front'}${blank ? ' blank' : ''}">${content}</section>`;
  const heading = (title: string) => `<header><h1>${escape(title)}</h1><p>${escape(coordinate)}${yearName ? ` · ${escape(yearName)}` : ''}</p></header>`;
  sheets.push(page(`<div class="cover"><p>CHRONO COMPASS</p><h1>${t('Epoch Calendar','Календарь Эпохи')}</h1><h2>${escape(coordinate)}</h2><p>${escape(yearName)}</p><p>${t('Free Days at the','Свободные дни:')} ${freeDays === 'end' ? t('end','в конце') : t('start','в начале')}</p><p>${escape(timezone)}</p></div>`), page('', true, true));
  for (const period of printPeriods(year, freeDays)) {
    const free = period.moon === 14;
    const title = free ? t('Free Days','Свободные дни') : `${t('Month','Месяц')} ${period.moon}${has('dreamspell') ? ` · ${tone(period.moon)}` : ''}`;
    const data = resolveCalendarLayers(selected, period.days[0].absolute, period.days.at(-1)!.absolute, epoch, timezone);
    const dayName = (n: number) => free ? (period.days.length === 1 ? 'S' : `S${n}`) : String(n);
    const cells = period.days.map(day => `<div class="cell week${free ? day.number - 1 : Math.floor((day.number-1)/7)}"><strong>${dayName(day.number)}</strong>${has('gregorian') ? `<span>${escape(civil(day.absolute))}</span>` : ''}<small>${escape(data.events.filter(e => e.day === day.absolute).map(calendarEventMarker).join(' '))}</small></div>`).join('');
    sheets.push(page(`${heading(title)}<div class="grid${free ? ' free' : ''}">${cells}</div>`));
    const sections: string[] = [];
    sections.push(`<section><h2>${t('Special days & reading the grid','Особые дни и чтение сетки')}</h2><p>${free ? t('S / S1–S4 are correction days outside the weekly cycle. They belong to the beginning of this year even when printed last.','S / S1–S4 — корректирующие дни вне недельного цикла. Они принадлежат началу этого года, даже если напечатаны в конце.') : t('28 days in four seven-day weeks. Week colors: red, white, blue, gold. Free Days have their own sheet.','28 дней: четыре семидневные недели. Цвета недель: красный, белый, синий, золотой. Свободным дням посвящён отдельный лист.')}</p><p>${escape(period.days[0].address)} — ${escape(period.days.at(-1)!.address)}</p></section>`);
    if (has('gregorian')) sections.push(`<section><h2>${t('Gregorian dates','Григорианские даты')}</h2><p>${escape(civil(period.days[0].absolute))} — ${escape(civil(period.days.at(-1)!.absolute))}. ${t('Grid dates: day.month.year.','Даты в сетке: день.месяц.год.')}</p></section>`);
    if (has('dreamspell')) sections.push(`<section><h2>Dreamspell</h2><p>${t('Wave','Волна')}: ${year.wave ? escape(tone(year.wave)) : 'X'} · ${t('Year','Год')}: ${escape(yearName || 'X')}</p><p>${free ? t('Outside the weekly cycle.','Вне недельного цикла.') : `${t('Month','Месяц')}: ${escape(tone(period.moon))}. ${t('Weeks 1–4','Недели 1–4')}: ${escape(actions.join(' → '))}.`}</p></section>`);
    if (has('chakras')) sections.push(`<section><h2>${t('Chakras','Чакры')}</h2><p>${free ? t('Free Days have no chakra weekday.','Свободным дням не назначается чакра дня недели.') : t('Columns 1–7, repeated each week:','Столбцы 1–7, повторяются каждую неделю:')}</p>${free ? '' : `<ol>${(language === 'ru' ? ruChakras : CHAKRAS.map(c=>`${c.name} · ${c.color}`)).map(c=>`<li>${escape(c)}</li>`).join('')}</ol>`}</section>`);
    for (const layer of data.layers) {
      const label = language === 'ru' ? ({season:'Сезонные события',bind:'Расстояние Земля–Солнце',lunar:'Фазы Луны'}[layer.id] || layer.label) : layer.label;
      const entries = layer.events.map(event => {
        const name = language === 'ru' ? ruEvents[layer.id]?.[['E','N','W','S'].indexOf(event.direction)] || event.label : event.label;
        const n = event.day - period.days[0].absolute + 1;
        const time = new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : 'en-GB', {timeZone:timezone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(event.ts);
        return `<li><b>${escape(dayName(n))}</b> · ${escape(calendarEventMarker(event))} ${escape(name)} · ≈ ${time}${has('gregorian') ? ` · ${escape(civil(event.day))}` : ''}</li>`;
      }).join('');
      sections.push(`<section><h2>${escape(label)}</h2>${!layer.available ? `<p>${t('Unavailable. Supported Gregorian years:','Недоступно. Поддерживаются григорианские годы:')} ${layer.supportedYears.join('–')}.</p>` : entries ? `<ul>${entries}</ul>` : `<p>${t('No events in this period.','В этом периоде нет событий.')}</p>`}</section>`);
    }
    sheets.push(page(`${heading(`${title} · ${t('Legend','Легенда')}`)}<p class="zone">${escape(timezone)} · ${t('Event times are approximate; lunar times rounded to the nearest minute.','Время событий приблизительное; лунные события округлены до минуты.')}</p><div class="legend">${sections.join('')}</div>`, true));
  }
  for (const appendix of options.appendices || []) {
    const content = (lines: string[]) => `${heading(appendix.title)}${lines.map(line=>`<p>${escape(line)}</p>`).join('')}`;
    sheets.push(page(content(appendix.front)), page(appendix.back ? content(appendix.back) : '', true, !appendix.back));
  }
  return `<!doctype html><html lang="${language}"><head><meta charset="utf-8"><title>${escape(coordinate)} · Epoch Calendar</title><style>
    @page { size: A4 landscape; margin: 0; }
    * { box-sizing: border-box; } body { margin: 0; color: #17212b; background: #d9dde2; font: 11pt Arial, sans-serif; }
    .page { width: 297mm; height: 210mm; padding: 24mm 12mm 12mm; margin: 8mm auto; background: white; break-after: page; page-break-after: always; position: relative; }
    .page.back { padding: 12mm 12mm 24mm; } .page:last-child { break-after: auto; page-break-after: auto; }
    h1 { font-size: 23pt; margin: 0 0 3mm; } h2 { font-size: 12pt; margin: 0 0 2mm; } p { margin: 0 0 3mm; line-height: 1.35; }
    header { height: 25mm; } .grid { display: grid; grid-template-columns: repeat(7,1fr); grid-template-rows: repeat(4,1fr); gap: 2mm; height: 147mm; }
    .grid.free { grid-template-columns: repeat(${correctionDays(year)},1fr); grid-template-rows: 1fr; }
    .cell { border: .3mm solid #8e969e; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2mm; border-radius: 2mm; }
    .cell strong { font-size: 23pt; } .cell small { font-size: 12pt; min-height: 5mm; }
    .week0 { background: #f6dedd; } .week1 { background: #fafafa; } .week2 { background: #dde8f7; } .week3 { background: #f9eac2; }
    .cover { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8mm; } .cover h1 { font-size: 38pt; }
    .zone { font-size: 9pt; } .legend { columns: 2; column-gap: 10mm; font-size: 10pt; line-height: 1.35; } .legend section { break-inside: avoid; margin-bottom: 4mm; } ul, ol { margin: 0; padding-left: 5mm; } li { margin-bottom: 1.5mm; }
    @media print { html, body { background: white; } .page { margin: 0; print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
  </style></head><body>${sheets.join('')}</body></html>`;
}
