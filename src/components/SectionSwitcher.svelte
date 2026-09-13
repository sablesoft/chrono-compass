<script lang="ts">
  export let section = 'calendar';
  let menu: HTMLDetailsElement;
  function close() { if (menu) menu.open = false; }
  function outside(event: MouseEvent) {
    if (event.target instanceof Node && menu && !menu.contains(event.target)) close();
  }
</script>

<svelte:window on:click={outside} on:keydown={(event) => { if (event.key === 'Escape') close(); }} />

<details bind:this={menu}>
  <summary title="Sections" aria-label="Sections">
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
  </summary>
  <nav aria-label="Sections">
    <a href="#calendar" aria-current={section === 'calendar' ? 'page' : undefined} on:click={close}>Epoch Calendar</a>
    <a href="#wheels" aria-current={section === 'wheels' ? 'page' : undefined} on:click={close}>Wheels Dashboard</a>
    <a href="#gregorian" aria-current={section === 'gregorian' ? 'page' : undefined} on:click={close}>Gregorian Calendar <small>Coming soon</small></a>
  </nav>
</details>

<style>
  details { position: relative; }
  summary { list-style: none; display: grid; place-items: center; cursor: pointer; padding: var(--sp-8) var(--sp-10); border-radius: var(--radius-12); border: 1px solid var(--btn-border); background: var(--btn-bg); color: var(--fg); min-height: 18px; }
  summary::-webkit-details-marker { display: none; }
  summary:focus-visible, a:focus-visible { outline: 2px solid var(--accent-blue); outline-offset: 2px; }
  nav { position: absolute; right: 0; top: calc(100% + 8px); width: max-content; max-width: calc(100vw - 40px); padding: 6px; border: 1px solid var(--panel-border); border-radius: var(--radius-12); background: var(--panel); box-shadow: 0 12px 32px #0003; z-index: 120; }
  a { display: flex; gap: 12px; align-items: center; justify-content: space-between; padding: 12px; color: var(--fg); text-decoration: none; border-radius: var(--radius-8); font-size: var(--fs-14, 14px); }
  a:hover, a[aria-current] { background: var(--btn-bg); }
  a[aria-current] { box-shadow: inset 3px 0 var(--accent-blue); }
  small { opacity: .55; }
  @media (max-width: 640px) { summary { padding: 0; width: var(--wheel-header-btn-size, 22px); height: var(--wheel-header-btn-size, 22px); box-sizing: border-box; border-radius: var(--radius-8); } summary svg { width: 14px; height: 14px; } }
</style>
