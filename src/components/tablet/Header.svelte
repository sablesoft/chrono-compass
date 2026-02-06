<script lang="ts">
    export let title = '';
    export let page = 0;
    export let pageCount = 1;
    export let isLandscape = true;

    export let onPrev: () => void = () => {};
    export let onNext: () => void = () => {};
</script>

<header class="h">
    <div class="row">
        <button class="btn" type="button" on:click={onPrev} disabled={page <= 0}>‹</button>

        <div class="center">
            <div class="title">{title}</div>
            <div class="sub">
                {pageCount ? `${page + 1} / ${pageCount}` : ''}
                {#if isLandscape}
                    <span class="dot">·</span> 2 wheels
                {/if}
            </div>
        </div>

        <button class="btn" type="button" on:click={onNext} disabled={page >= pageCount - 1}>›</button>
    </div>
</header>

<style>
    .h {
        position: sticky;
        top: 0;
        z-index: 50;
        background: var(--bg);
        border-bottom: 1px solid rgba(255,255,255,0.08);
        padding: 10px 12px;
    }

    .row {
        display: grid;
        grid-template-columns: 46px 1fr 46px;
        align-items: center;
        gap: 10px;
    }

    .btn {
        height: 46px;
        width: 46px;
        border-radius: 14px;
        border: 1px solid rgba(255,255,255,0.14);
        background: rgba(255,255,255,0.06);
        color: var(--fg);
        font-size: 24px;
    }
    .btn:disabled { opacity: 0.35; }

    .center { text-align: center; }
    .title { font-weight: 750; font-size: 18px; line-height: 1.1; }
    .sub { opacity: 0.72; font-size: 12px; margin-top: 3px; }
    .dot { margin: 0 6px; opacity: 0.6; }
</style>