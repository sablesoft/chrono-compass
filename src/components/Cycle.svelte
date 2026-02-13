<!--src/components/Cycle.svelte -->
<script lang="ts">
    import { solveWheel } from '../lib/board/dispatcher';
    import type {BoardWheel} from "../lib/board/types";

    export let wheel: BoardWheel;
    export let selectedTs: number;
    export let location: any;

    // пока просто используем selectedTs как ts.
    // позже ты перенесёшь свою логику locked/live/effTs сюда (один раз на все циклы)
    $: res = solveWheel(wheel, { ts: selectedTs, location });

    $: spokes = (res.ok && res.kind === 'cycle') ? res.spokes : [];
</script>

<section class="panel">
    <!-- тут будет твой wheel UI: рисуем 17 спиц, два указателя, тултипы и т.д. -->
    <div>Cycle wheel: {wheel.wheelType} · spokes: {spokes.length}</div>
</section>
