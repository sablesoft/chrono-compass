<script lang="ts">
    export let title = '';
    export let index = 0;
    export let count = 0;

    export let onPrev: () => void = () => {};
    export let onNext: () => void = () => {};
</script>

<header class="h">
    <div class="row">
        <button class="btn" type="button" on:click={onPrev} disabled={index <= 0}>‹</button>

        <div class="center">
            <div class="title">{title}</div>
            <div class="sub">{count ? `${index + 1} / ${count}` : ''}</div>
        </div>

        <button class="btn" type="button" on:click={onNext} disabled={index >= count - 1}>›</button>
    </div>
</header>

<style>
    .h {
        position: sticky;
        top: 0;
        z-index: 50;
        background: var(--bg);
        border-bottom: 1px solid rgba(255,255,255,0.08);
        padding: 10px 10px;
    }

    .row {
        display: grid;
        grid-template-columns: 42px 1fr 42px;
        align-items: center;
        gap: 8px;
    }

    .btn {
        height: 42px;
        width: 42px;
        border-radius: 12px;
        border: 1px solid rgba(255,255,255,0.14);
        background: rgba(255,255,255,0.06);
        color: var(--fg);
        font-size: 22px;
    }
    .btn:disabled { opacity: 0.35; }

    .center { text-align: center; }
    .title { font-weight: 700; font-size: 16px; line-height: 1.1; }
    .sub { opacity: 0.7; font-size: 12px; margin-top: 2px; }
</style>
