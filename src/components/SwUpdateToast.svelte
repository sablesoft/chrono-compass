<script lang="ts">
    import { onMount } from 'svelte'
    import { registerSW } from 'virtual:pwa-register'

    let needRefresh = false
    let offlineReady = false

    let updateSW: ((reloadPage?: boolean) => Promise<void>) | null = null

    onMount(() => {
        updateSW = registerSW({
            onNeedRefresh() {
                needRefresh = true
            },
            onOfflineReady() {
                offlineReady = true
                setTimeout(() => (offlineReady = false), 2500)
            }
        })
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
            Доступна новая версия Chrono Compass.
        </div>
        <div class="sw-toast__actions">
            <button on:click={refresh}>Обновить</button>
            <button on:click={close}>Позже</button>
        </div>
    </div>
{/if}

{#if offlineReady}
    <div class="sw-toast">
        <div class="sw-toast__text">
            Приложение готово к оффлайн-работе.
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
        padding: 12px 14px;
        border-radius: 12px;
        background: rgba(20,20,24,0.95);
        border: 1px solid rgba(255,255,255,0.12);
        color: rgba(255,255,255,0.92);
        display: flex;
        gap: 12px;
        align-items: center;
        justify-content: space-between;
        backdrop-filter: blur(10px);
    }
    .sw-toast__actions{ display:flex; gap:8px; }
    button{
        padding: 8px 10px;
        border-radius: 10px;
        border: 1px solid rgba(255,255,255,0.16);
        background: rgba(255,255,255,0.06);
        color: rgba(255,255,255,0.92);
        cursor: pointer;
    }
    button:hover{ background: rgba(255,255,255,0.10); }
</style>
