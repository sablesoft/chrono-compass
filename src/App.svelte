<script lang="ts">
  import Wheel from './Wheel.svelte';

  let selectedIndex = 0;
</script>

<main>
  <h1>Wheels</h1>

  <div class="wrap">
    <Wheel size={640} bind:selectedIndex />
  </div>

  <p class="hint">Click a spoke to move the pointer.</p>
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
