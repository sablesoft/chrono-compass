<script lang="ts">
  import Wheel from './Wheel.svelte';

  // пока: привязка "угол = спица"
  let selectedSpokeIndex: number | null = 0;
  let pointerAngleDeg = 0;

  const spokeCount = 16;
  const stepDeg = 360 / spokeCount;

  function spokeToAngle(i: number) {
    // time-forward is CCW => negative
    return -stepDeg * i;
  }

  function onSelectSpoke(i: number) {
    selectedSpokeIndex = i;
    pointerAngleDeg = spokeToAngle(i);
  }

  function onSelectNextE() {
    // "end of cycle" then "snap to next cycle start"
    selectedSpokeIndex = null;         // подсветку можно убрать на момент перехода
    pointerAngleDeg = -360;            // докрутка до конца
    setTimeout(() => {
      pointerAngleDeg = 0;             // новый цикл, начало
      selectedSpokeIndex = 0;
    }, 420);
  }
</script>

<main>
  <h1>Wheels</h1>

  <div class="wrap">
    <Wheel
            size={640}
            selectedSpokeIndex={selectedSpokeIndex}
            pointerAngleDeg={pointerAngleDeg}
            onSelectSpoke={onSelectSpoke}
            onSelectNextE={onSelectNextE}
    />
  </div>

  <p class="hint">Click a spoke to move the pointer. E+ moves to next cycle.</p>
</main>

<style>
  main {
    padding: 24px;
    font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    background: #0b0b0c;
    min-height: 100vh;
    color: #e7e7ea;
  }
  h1 {
    margin: 0 0 16px;
    font-size: 20px;
    font-weight: 600;
    opacity: 0.9;
  }
  .wrap {
    display: inline-block;
    padding: 18px;
    border-radius: 18px;
    border: 1px solid rgba(231, 231, 234, 0.12);
    background: rgba(231, 231, 234, 0.04);
  }
  .hint {
    margin-top: 12px;
    opacity: 0.7;
    font-size: 13px;
  }
</style>
