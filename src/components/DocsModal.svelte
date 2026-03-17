<!-- src/components/DocsModal.svelte -->
<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import MarkdownIt from 'markdown-it';

    export let open = false;
    export let title = 'Docs';
    export let md = '';
    export let url = '';
    export let onClose: () => void = () => {};

    const mdIt = new MarkdownIt({
        html: false,
        linkify: true,
        typographer: true,
    });

    $: html = mdIt.render(md || '');

    function close() {
        onClose();
    }

    function onKeydown(e: KeyboardEvent) {
        if (e.key === 'Escape') close();
    }

    onMount(() => {
        window.addEventListener('keydown', onKeydown);
    });

    onDestroy(() => {
        window.removeEventListener('keydown', onKeydown);
    });
</script>

{#if open}
    <div class="backdrop" on:click={close} aria-hidden="true"></div>

    <div class="modal" role="dialog" aria-modal="true" aria-label={title}>
        <header class="head">
            <div class="hleft">
                <div class="htitle">{title}</div>
                {#if url}
                    <div class="hurl">{url}</div>
                {/if}
            </div>
            <button class="x" type="button" on:click={close} aria-label="Close">✕</button>
        </header>

        <div class="body">
            <div class="md">{@html html}</div>
        </div>

        <footer class="foot">
            {#if url}
                <a class="link" href={url} target="_blank" rel="noreferrer">Open raw file</a>
            {/if}
            <button class="btn" type="button" on:click={close}>Close</button>
        </footer>
    </div>
{/if}

<style>
    .backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.55);
        z-index: 12000;
    }
    .modal {
        position: fixed;
        left: 50%;
        top: max(86px, calc(env(safe-area-inset-top) + 86px));
        width: min(980px, calc(100vw - 36px));
        max-height: calc(100vh - 100px);
        transform: translateX(-50%);
        background: var(--panel);
        border: 1px solid var(--panel-border);
        border-radius: var(--radius-18);
        z-index: 12001;
        display: grid;
        grid-template-rows: auto 1fr auto;
        overflow: hidden;
    }
    .head {
        display: flex;
        justify-content: space-between;
        gap: var(--sp-12);
        padding: var(--sp-14) var(--sp-16);
        border-bottom: 1px solid var(--panel-border);
        align-items: center;
    }
    .htitle { font-size: var(--fs-18); font-weight: 800; }
    .hurl { opacity: 0.55; font-size: var(--fs-12); font-variant-numeric: tabular-nums; }
    .x {
        border: 1px solid var(--btn-border);
        background: var(--btn-bg);
        color: inherit;
        border-radius: var(--radius-10);
        padding: var(--sp-8) var(--sp-10);
        cursor: pointer;
        opacity: 0.9;
    }
    .body {
        padding: var(--sp-14) var(--sp-16);
        overflow: auto;
    }
    .md :global(h1) { font-size: var(--fs-22); margin: 0 0 12px; }
    .md :global(h2) { font-size: var(--fs-18); margin: 18px 0 10px; }
    .md :global(p) { opacity: 0.9; line-height: 1.55; }
    .md :global(code) { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .md :global(pre) {
        padding: var(--sp-12);
        border-radius: var(--radius-12);
        border: 1px solid var(--panel-border);
        overflow: auto;
    }
    .foot {
        padding: var(--sp-12) var(--sp-16);
        border-top: 1px solid var(--panel-border);
        display: flex;
        justify-content: flex-end;
        gap: var(--sp-10);
        align-items: center;
    }
    .link { opacity: 0.75; margin-right: auto; }
    .btn {
        border: 1px solid var(--btn-border);
        background: var(--btn-bg);
        color: inherit;
        border-radius: var(--radius-10);
        padding: var(--sp-8) var(--sp-12);
        cursor: pointer;
        font-weight: 700;
    }

    @media (max-width: 640px) {
        .modal {
            inset: 0;
            left: 0;
            top: 0;
            width: 100vw;
            height: 100dvh;
            max-height: 100dvh;
            transform: none;
            border-radius: 0;
            border-left: 0;
            border-right: 0;
            border-top: 0;
        }
        .head {
            padding-top: calc(var(--sp-12) + env(safe-area-inset-top));
        }
        .foot {
            padding-bottom: calc(var(--sp-12) + env(safe-area-inset-bottom));
        }
        .body {
            overflow-y: auto;
            overflow-x: hidden;
            -webkit-overflow-scrolling: touch;
        }
    }
</style>
