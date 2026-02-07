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

    <section class="modal" role="dialog" aria-modal="true" aria-label={title}>
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
    </section>
{/if}

<style>
    .backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.55);
        z-index: 1000;
    }
    .modal {
        position: fixed;
        inset: 7vh 7vw;
        background: var(--panel);
        border: 1px solid var(--panel-border);
        border-radius: 18px;
        z-index: 1001;
        display: grid;
        grid-template-rows: auto 1fr auto;
        overflow: hidden;
    }
    .head {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        padding: 14px 16px;
        border-bottom: 1px solid var(--panel-border);
        align-items: center;
    }
    .htitle { font-size: 18px; font-weight: 800; }
    .hurl { opacity: 0.55; font-size: 12px; font-variant-numeric: tabular-nums; }
    .x {
        border: 1px solid var(--btn-border);
        background: var(--btn-bg);
        color: inherit;
        border-radius: 10px;
        padding: 8px 10px;
        cursor: pointer;
        opacity: 0.9;
    }
    .body {
        padding: 14px 16px;
        overflow: auto;
    }
    .md :global(h1) { font-size: 22px; margin: 0 0 12px; }
    .md :global(h2) { font-size: 18px; margin: 18px 0 10px; }
    .md :global(p) { opacity: 0.9; line-height: 1.55; }
    .md :global(code) { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .md :global(pre) {
        padding: 12px;
        border-radius: 12px;
        border: 1px solid var(--panel-border);
        overflow: auto;
    }
    .foot {
        padding: 12px 16px;
        border-top: 1px solid var(--panel-border);
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        align-items: center;
    }
    .link { opacity: 0.75; margin-right: auto; }
    .btn {
        border: 1px solid var(--btn-border);
        background: var(--btn-bg);
        color: inherit;
        border-radius: 10px;
        padding: 8px 12px;
        cursor: pointer;
        font-weight: 700;
    }
</style>