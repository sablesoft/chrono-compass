<script lang="ts">
    import { onMount } from "svelte";

    export type Theme = "dark" | "light";
    let theme: Theme = "dark";

    function applyTheme(t: Theme) {
        theme = t;
        document.documentElement.dataset.theme = t;
        localStorage.setItem("theme", t);
    }

    function toggleTheme() {
        applyTheme(theme === "dark" ? "light" : "dark");
    }

    onMount(() => {
        const saved = localStorage.getItem("theme") as Theme | null;

        if (saved === "dark" || saved === "light") {
            applyTheme(saved);
            return;
        }

        // если пользователь ещё не выбирал — берём системную
        const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
        applyTheme(prefersLight ? "light" : "dark");
    });
</script>

<button class="themeSwitch" on:click={toggleTheme} title="Toggle theme">
    {#if theme === "dark"}
        ☀︎
    {:else}
        ☾
    {/if}
</button>

<style>
    .themeSwitch {
        padding: 8px 10px;
        border-radius: 10px;
        border: 1px solid var(--btn-border);
        background: var(--btn-bg);
        color: inherit;
        cursor: pointer;
        font-size: 18px;
        line-height: 1;
    }

    .themeSwitch:hover {
        opacity: 0.9;
    }
</style>
