<script lang="ts">
    import { onMount } from 'svelte'
    import { registerSW } from 'virtual:pwa-register'
    import { initCycleCacheStorage } from '../lib/cycle/store'

    let needRefresh = false
    let offlineReady = false

    let updateSW: ((reloadPage?: boolean) => Promise<void>) | null = null
    const CACHE_CHECK_INTERVAL_MS = 5 * 60_000

    function runCycleCacheVersionCheck() {
        void initCycleCacheStorage().catch(() => {})
    }

    onMount(() => {
        runCycleCacheVersionCheck()

        const cacheCheckTimer = window.setInterval(() => {
            runCycleCacheVersionCheck()
        }, CACHE_CHECK_INTERVAL_MS)

        updateSW = registerSW({
            onNeedRefresh() {
                runCycleCacheVersionCheck()
                needRefresh = true
            },
            onOfflineReady() {
                runCycleCacheVersionCheck()
                offlineReady = true
                setTimeout(() => (offlineReady = false), 2500)
            }
        })

        return () => {
            window.clearInterval(cacheCheckTimer)
        }
    })

    async function refresh() {
        // спрятать тост сразу, чтобы не бесил
        needRefresh = false

        // если по какой-то причине updateSW ещё не готов — просто перезагрузи страницу
        if (!updateSW) {
            location.reload()
            return
        }

        try {
            // попросить новый SW активироваться и (в идеале) перезагрузить страницу
            await updateSW(true)

            // страховка: если по каким-то причинам reload не случился — сделаем сами
            // (бывает, когда браузер удерживает старый контроллер)
            setTimeout(() => location.reload(), 300)
        } catch (e) {
            // если обновление не удалось — просто перезагрузим
            location.reload()
        }
    }

    function close() {
        needRefresh = false
        offlineReady = false
    }
</script>
{#if needRefresh}
    <div class="sw-toast">
        <div class="sw-toast__text">
            A new version is available.
        </div>
        <div class="sw-toast__actions">
            <button on:click={refresh}>Refresh</button>
            <button on:click={close}>Later</button>
        </div>
    </div>
{/if}

{#if offlineReady}
    <div class="sw-toast">
        <div class="sw-toast__text">
            The application is ready for offline use.
        </div>
        <div class="sw-toast__actions">
            <button on:click={close}>Ок</button>
        </div>
    </div>
{/if}

<style>
    .sw-toast{
        position: fixed;
        left: 16px;
        right: 16px;
        bottom: 16px;
        z-index: 9999;
        padding: var(--sp-12) var(--sp-14);
        border-radius: var(--radius-12);
        background: rgba(20,20,24,0.95);
        border: 1px solid rgba(255,255,255,0.12);
        color: rgba(255,255,255,0.92);
        display: flex;
        gap: var(--sp-12);
        align-items: center;
        justify-content: space-between;
        backdrop-filter: blur(10px);
    }
    .sw-toast__actions{ display:flex; gap:var(--sp-8); }
    button{
        padding: var(--sp-8) var(--sp-10);
        border-radius: var(--radius-10);
        border: 1px solid rgba(255,255,255,0.16);
        background: rgba(255,255,255,0.06);
        color: rgba(255,255,255,0.92);
        cursor: pointer;
    }
    button:hover{ background: rgba(255,255,255,0.10); }
</style>
