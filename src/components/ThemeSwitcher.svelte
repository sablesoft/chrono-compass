<!-- src/components/ThemeSwitcher.svelte -->
<script lang="ts">
    import { onMount } from 'svelte';

    type Theme = 'dark' | 'light';
    const KEY = 'tw_theme';

    let theme: Theme = 'dark';

    function apply(t: Theme) {
        theme = t;
        document.documentElement.dataset.theme = t;
        localStorage.setItem(KEY, t);
    }

    function toggle() {
        apply(theme === 'dark' ? 'light' : 'dark');
    }

    onMount(() => {
        const saved = localStorage.getItem(KEY) as Theme | null;
        if (saved === 'dark' || saved === 'light') {
            apply(saved);
            return;
        }
        const prefersLight = window.matchMedia?.('(prefers-color-scheme: light)').matches;
        apply(prefersLight ? 'light' : 'dark');
    });
</script>

<button class="icon" on:click={toggle} title="Theme">
    {theme === 'dark' ? '🌙' : '☀️'}
</button>

<style>
    button.icon{
        padding: var(--sp-8) var(--sp-10);
        border-radius: var(--radius-12);
        border: 1px solid var(--btn-border);
        background: var(--btn-bg);
        color: inherit;
        cursor: pointer;
    }
</style>
