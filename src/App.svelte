<script lang="ts">
  import Wheel from './Wheel.svelte';
  import SunCalc from 'suncalc';

  const SPOKES = 16;
  const ANIM_MS = 420;

  // Paraty (примерно). Потом сделаем UI для выбора.
  let lat = -23.22;
  let lon = -44.72;

  // выбранный момент времени (истина)
  let selectedTs = Date.now();

  // подсветка спицы только когда кликнули по спице
  let selectedSpokeIndex: number | null = null;

  function getCycleStartForDay(day: Date) {
    const t = SunCalc.getTimes(day, lat, lon);
    // E = sunrise
    return t.sunrise.getTime();
  }

  function getCycleWindow(ts: number) {
    // вычисляем "рассвет, содержащий выбранный момент"
    const d = new Date(ts);
    const startToday = getCycleStartForDay(d);

    let start = startToday;
    if (ts < startToday) {
      const prev = new Date(d);
      prev.setDate(prev.getDate() - 1);
      start = getCycleStartForDay(prev);
    }

    const next = new Date(start);
    next.setDate(next.getDate() + 1);
    const end = getCycleStartForDay(next);

    return { start, end };
  }

  function clamp01(x: number) {
    return Math.max(0, Math.min(1, x));
  }

  function formatTime(ts: number) {
    return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }

  function spokeTs(i: number, start: number, end: number) {
    const dur = end - start;
    return start + (dur * i) / SPOKES;
  }

  // производные величины для UI
  $: cycle = getCycleWindow(selectedTs);
  $: durationMs = cycle.end - cycle.start;
  $: progress = clamp01((selectedTs - cycle.start) / durationMs);
  $: pointerAngleDeg = -360 * progress;

  function onSelectSpoke(i: number) {
    selectedSpokeIndex = i;
    selectedTs = spokeTs(i, cycle.start, cycle.end);
  }

  function onSelectNextE() {
    // докручиваем до конца цикла (почти до следующего рассвета),
    // затем снапим на начало нового цикла (точно следующий рассвет)
    selectedSpokeIndex = null;
    selectedTs = cycle.end - 1;

    setTimeout(() => {
      selectedTs = cycle.end;   // это уже новый цикл, start==end прошлого
      selectedSpokeIndex = 0;
    }, ANIM_MS);
  }

  function setNow() {
    selectedSpokeIndex = null;
    selectedTs = Date.now();
  }

  // (пока без "живого режима часов" — это будет следующим этапом)
</script>

<main>
  <header>
    <h1>Day wheel (Paraty)</h1>
    <button on:click={setNow}>Now</button>
  </header>

  <div class="wrap">
    <Wheel
            size={640}
            selectedSpokeIndex={selectedSpokeIndex}
            pointerAngleDeg={pointerAngleDeg}
            onSelectSpoke={onSelectSpoke}
            onSelectNextE={onSelectNextE}
    />
  </div>

  <section class="info">
    <div><strong>Selected:</strong> {formatTime(selectedTs)}</div>
    <div><strong>Cycle start (sunrise):</strong> {formatTime(cycle.start)}</div>
    <div><strong>Cycle end (next sunrise):</strong> {formatTime(cycle.end)}</div>
    <div><strong>Progress:</strong> {(progress * 100).toFixed(1)}%</div>
  </section>
</main>

<style>
  main {
    padding: 24px;
    font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    background: #0b0b0c;
    min-height: 100vh;
    color: #e7e7ea;
  }
  header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
  }
  h1 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    opacity: 0.9;
  }
  button {
    padding: 8px 10px;
    border-radius: 10px;
    border: 1px solid rgba(231,231,234,0.18);
    background: rgba(231,231,234,0.06);
    color: inherit;
    cursor: pointer;
  }
  .wrap {
    display: inline-block;
    padding: 18px;
    border-radius: 18px;
    border: 1px solid rgba(231, 231, 234, 0.12);
    background: rgba(231, 231, 234, 0.04);
  }
  .info {
    margin-top: 14px;
    opacity: 0.85;
    font-size: 13px;
    line-height: 1.6;
  }
</style>
