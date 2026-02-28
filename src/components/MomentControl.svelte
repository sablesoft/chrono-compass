<!-- src/component/MomentControl.svelte -->
<script lang="ts">
    import {
        momentsState,
        normalizeTsMinute,
        upsertMoment,
        deleteMoment,
        setCurrentCollection,
        findMomentInCollectionByTsFromState
    } from '../lib/stores/moment';
    import type { RepeatRule, RepeatUnit, OnDayMode, RepeatEnd } from '../lib/stores/moment';
    import DropdownButton from './DropdownButton.svelte';
    import { getCycleOptions } from '../lib/cycle/meta';
    import type { CycleKind } from '../lib/stores/cycle';
    import Portal from "svelte-portal";

    export let buttonClass = '';

    let emoji = '📍';

    let emojiOpen = false;
    let emojiWrap: HTMLDivElement | null = null;

    export let ts: number; // IMPORTANT: number, not store

    let open = false;
    let editingId: string | null = null;

    let collectionId = '';
    let title = '';
    let description = '';

    let repeatOn = false;
    let repeatEvery = 1;
    let repeatUnit: RepeatUnit = 'year';
    let repeatOnDay: OnDayMode = 'clamp';

    let repeatEndMode: RepeatEnd['mode'] = 'never';
    let repeatUntilLocal = ''; // строка для datetime-local, если решишь его ставить (или date)
    let repeatCount = 1;
    const formId = `moment-${Math.random().toString(36).slice(2, 8)}`;

    let momentCycles: CycleKind[] = [];

    // Минимальный набор “полезных” для моментов. Потом расширишь/категории добавишь.
    const EMOJI_PRESET = Array.from(new Set([
        // Core / markers / status
        '📍','🏷️','🔖','📌','🧷','🧲','✅','☑️','❎','⚠️','🚫','⛔️','🔒','🔓','🆘','🕳️',
        '⭐️','🌟','✨','💎','🏁','🎯','🧭','🗺️','🗓️','📅','⏳','⌛️','🕰️','⏰','🔔','🧾',
        // Time-of-life / personal / mood
        '🙂','😊','😄','😁','😅','😂','🤣','😎','🤓','🤔','🫠','😮','😯','😴','🥱','😵‍💫',
        '😍','🥰','😘','😡','😤','😭','😢','😌','🧘','🧘‍♀️','🧘‍♂️','🧠','💤','💭',
        // People / relationships
        '👤','👥','🧑‍🤝‍🧑','👪','🤝','🙏','💬','🗣️','📣','📞','☎️','📱','✉️','📩','💌','💍',
        '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔',
        // Work / planning / notes
        '📝','✍️','📌','📎','🗂️','📁','📚','📖','🧾','🧮','📊','📈','📉','🧠','💡','🔍',
        '🧩','🧰','🔧','🪛','🔨','🪚','⚙️','🛠️','🧪','🧫','🔬','🔭','📡',
        // Dev / tech
        '💻','🖥️','⌨️','🖱️','🧑‍💻','👨‍💻','👩‍💻','🗃️','🧷','🔗','🌐','📦','🧵','🧯','🐛','🚀',
        // Creativity / fun / media
        '🎨','🖌️','🖍️','📷','📸','🎥','🎬','🎞️','🎧','🎶','🎵','🎮','🕹️','🎲','🃏','🎭',
        '🎂','🎉','🎊','🎁','🎈','🪩','✨',
        // Health / body
        '💪','🫀','🩺','💊','🧴','🛌','🥗','🍎','🍵','💧','🧊','🌡️','🧼','🩹','🏃','🚶',
        // Places / home / nature
        '🏡','🏠','🏢','🏙️','🏘️','🏞️','🌋','🏔️','⛰️','🏝️','🏖️','🌊','🌅','🌄','🌲','🌳',
        '🌵','🌴','🍀','🪴','🌺','🌸','🌼','🍂','🍁',
        // Travel / transport
        '🚗','🚙','🛻','🚌','🚎','🚇','🚆','🚄','🚂','🚲','🛵','🏍️','✈️','🛫','🛬','🚢',
        '⛵️','🚤','🛶','🧳','🧭','🛤️','🗺️',
        // Money / admin
        '💰','💵','💳','🏦','🧾','📜','✒️','🪪','🗝️',
        // Weather / climate
        '☀️','🌤️','⛅️','🌥️','☁️','🌦️','🌧️','⛈️','🌩️','🌨️','❄️','🌬️','💨','🌫️','☔️','🌪️',
        '🌀','🌈',
        // Astronomy / astro-symbolic
        '🌞','🌙','🌑','🌒','🌓','🌔','🌕','🌖','🌗','🌘','🌚','🌝',
        '🪐','🌍','🌎','🌏','☄️','🌠','⭐️','✨','🔭','📡',
        '♈️','♉️','♊️','♋️','♌️','♍️','♎️','♏️','♐️','♑️','♒️','♓️',
        // Elements / forces (для твоих “онтологических” меток)
        '🔥','💧','🌬️','🪨','⚡️','🌊','🌪️','🌋'
    ]));

    $: state = $momentsState;
    $: tsN = normalizeTsMinute(ts);

    $: currentColId = state.currentCollectionId ?? state.collections[0]?.id ?? null;
    $: existing = currentColId
        ? findMomentInCollectionByTsFromState(state, currentColId, tsN)
        : null;

    $: mode = existing ? 'edit' : 'save';

    $: cycleOptions = getCycleOptions(); // уже отсортированы по order
    $: cycleItems = cycleOptions.map(o => ({
        value: o.kind,
        label: o.label,
        title: o.title,
        disabled: o.disabled
    }));

    // дефолт: все циклы, кроме самого большого (последнего в отсортированном списке)
    $: defaultMomentCycles = (() => {
        const enabled = cycleOptions.filter(o => !o.disabled).map(o => o.kind);
        if (enabled.length <= 1) return enabled;         // на всякий
        return enabled.slice(0, -1);                      // отрезаем "plato" (и любые будущие “самые большие”)
    })();

    const EMOJI_MAX_LEN = 5;

    function toggleEmojiAccordion() {
        emojiOpen = !emojiOpen;
    }

    function pickEmoji(e: string) {
        emoji = e;
        emojiOpen = false;
    }

    function setEmojiFromInput(raw: string) {
        const v = (raw ?? '').trim();

        // валидируем просто длину (как ты просил). пустое — игнор
        if (!v) return;

        // <= 3 символов. (Да, эмодзи могут быть “длиннее” по codepoints,
        // но ты просил простую проверку по длине строки.)
        if (v.length > EMOJI_MAX_LEN) return;

        emoji = v;
    }

    function handleMomentCyclesChange(next: string[]) {
        const arr = (next as CycleKind[]);
        momentCycles = arr.length ? arr : defaultMomentCycles;
    }

    function onEmojiInput(e: Event) {
        const el = e.currentTarget as HTMLInputElement;
        setEmojiFromInput(el.value);
    }

    // закрывать по клику снаружи
    function onDocPointerDown(ev: PointerEvent) {
        if (!emojiOpen) return;
        const t = ev.target as Node;
        if (emojiWrap && !emojiWrap.contains(t)) emojiOpen = false;
    }

    // закрывать по Esc
    function onDocKeyDown(ev: KeyboardEvent) {
        if (ev.key === 'Escape') emojiOpen = false;
    }

    // подключи/отключи глобальные слушатели, когда поповер открыт
    $: {
        if (emojiOpen) {
            document.addEventListener('pointerdown', onDocPointerDown, true);
            document.addEventListener('keydown', onDocKeyDown, true);
        } else {
            document.removeEventListener('pointerdown', onDocPointerDown, true);
            document.removeEventListener('keydown', onDocKeyDown, true);
        }
    }

    function toLocalInputValue(ts: number) {
        const d = new Date(ts);
        const pad = (n: number) => String(n).padStart(2, '0');
        const yyyy = d.getFullYear();
        const mm = pad(d.getMonth() + 1);
        const dd = pad(d.getDate());
        const hh = pad(d.getHours());
        const mi = pad(d.getMinutes());
        return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
    }

    function fromLocalInputValue(v: string) {
        if (!v) return NaN;
        const d = new Date(v);
        const t = d.getTime();
        return normalizeTsMinute(t);
    }

    function buildRepeat(): RepeatRule | undefined {
        if (!repeatOn) return undefined;

        const every = Math.max(1, Math.min(999, Math.floor(repeatEvery || 1)));

        let end: RepeatEnd = { mode: 'never' };
        if (repeatEndMode === 'count') {
            end = { mode: 'count', count: Math.max(1, Math.min(9999, Math.floor(repeatCount || 1))) };
        } else if (repeatEndMode === 'until') {
            const untilTs = fromLocalInputValue(repeatUntilLocal); // helper (см ниже)
            if (Number.isFinite(untilTs)) end = { mode: 'until', untilTs };
        }

        return { every, unit: repeatUnit, onDay: repeatOnDay, end };
    }

    function openDialog() {
        if (existing) {
            editingId = existing.id;
            collectionId = existing.collectionId;
            title = existing.title;
            description = existing.description ?? '';
            momentCycles = (existing.cycles?.length ? existing.cycles : defaultMomentCycles);
            emoji = existing.emoji || '📍';
        } else {
            editingId = null;
            collectionId = currentColId ?? state.collections[0]?.id ?? '';
            title = '';
            description = '';
            momentCycles = defaultMomentCycles;
            emoji = '📍';
        }
        if (existing?.repeat) {
            repeatOn = true;
            repeatEvery = existing.repeat.every ?? 1;
            repeatUnit = existing.repeat.unit ?? 'year';
            repeatOnDay = existing.repeat.onDay ?? 'clamp';
            const end = existing.repeat.end ?? { mode: 'never' };
            repeatEndMode = end.mode;

            if (end.mode === 'until') {
                repeatUntilLocal = toLocalInputValue(end.untilTs); // у тебя уже есть helper? если нет — можно сделать быстро
            } else if (end.mode === 'count') {
                repeatCount = end.count ?? 1;
            }
        } else {
            repeatOn = false;
            repeatEvery = 1;
            repeatUnit = 'year';
            repeatOnDay = 'clamp';
            repeatEndMode = 'never';
            repeatUntilLocal = '';
            repeatCount = 1;
        }
        open = true;
    }

    function close() {
        open = false;
    }

    function save() {
        if (!collectionId) return;

        let moment = {
            id: editingId ?? undefined,
            ts: ts,
            collectionId,
            title,
            description,
            cycles: momentCycles,
            emoji: (emoji || '📍').slice(0, 5),
            repeat: buildRepeat(),
        };
        upsertMoment(moment);
        setCurrentCollection(collectionId);
        open = false;
    }

    function remove() {
        open = false;
        title = '';
        description = '';
        emoji = '📍';

        if (!editingId) return;

        deleteMoment(editingId);
        editingId = null;
    }

    function onKeydown(e: KeyboardEvent) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            save();
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            close();
        }
    }
</script>

<button class={`mc-btn ${buttonClass}`}
        on:click={openDialog}
        aria-label={mode === 'edit' ? 'Edit moment' : 'Save moment'}
        title={mode === 'edit' ? 'Edit moment' : 'Save moment'}>
    {#if mode === 'edit'}✏️{:else}💾{/if}
</button>

{#if open}
    <Portal target="body">
        <button type="button" class="mc-backdrop" aria-label="Close moment editor" on:click={close}></button>

        <div class="mc-modal" role="dialog" aria-modal="true" on:keydown={onKeydown} tabindex="0">
            <header class="mc-head">
                <div class="mc-title">{mode === 'edit' ? 'Edit moment' : 'Save moment'}</div>
                <button class="mc-x" on:click={close} aria-label="Close">✕</button>
            </header>

            <div class="mc-body">
                <div class="row">
                    <label for={`${formId}-collection`}>Collection</label>
                    <select id={`${formId}-collection`} bind:value={collectionId}>
                        {#each state.collections as c (c.id)}
                            <option value={c.id}>{c.name}</option>
                        {/each}
                    </select>
                </div>

                <div class="row">
                    <DropdownButton
                            label="Cycles:"
                            items={cycleItems}
                            value={momentCycles}
                            onChange={handleMomentCyclesChange}
                            buttonClass="seg cyclesBtn"
                    />
                </div>

                <!-- Repeat Logic -->
                <div class="row">
                    <div class="rowLine">
                        <div class="segGroup">
                            <div class="segLabel">Repeat</div>
                            <button type="button" class="segBtn" on:click={() => (repeatOn = !repeatOn)} aria-pressed={repeatOn}>
                                <span>{repeatOn ? 'On' : 'Off'}</span>
                                <span class="segCaret">{repeatOn ? '▴' : '▾'}</span>
                            </button>
                        </div>

                        <div class="segGroup">
                            <div class="segLabel">When</div>
                            <div class="segValue" title={new Date(tsN).toLocaleString()}>
                                {new Date(tsN).toLocaleString()}
                            </div>
                        </div>
                    </div>

                    {#if repeatOn}
                        <div class="repeatAccordion" role="group" aria-label="Repeat options">
                            <div class="repeatRow">
                                <label class="mini" for={`${formId}-repeat-every`}>Every</label>
                                <div class="repeatEvery">
                                    <input id={`${formId}-repeat-every`} class="num" type="number" min="1" max="999" bind:value={repeatEvery} />
                                    <select bind:value={repeatUnit}>
                                        <option value="year">year</option>
                                        <option value="month">month</option>
                                        <option value="week">week</option>
                                        <option value="day">day</option>
                                        <option value="hour">hour</option>
                                        <option value="minute">minute</option>
                                    </select>
                                </div>
                            </div>

                            {#if repeatUnit === 'month' || repeatUnit === 'year'}
                                <div class="repeatRow">
                                    <label class="mini" for={`${formId}-repeat-on-day`}>On day</label>
                                    <select id={`${formId}-repeat-on-day`} bind:value={repeatOnDay}>
                                        <option value="clamp">clamp to last day</option>
                                        <option value="same">same day, otherwise skip</option>
                                        {#if repeatUnit === 'month'}
                                            <option value="last">always last day of month</option>
                                        {/if}
                                    </select>
                                </div>
                            {/if}

                            <div class="repeatRow">
                                <label class="mini" for={`${formId}-repeat-end`}>End</label>
                                <div class="repeatEnd">
                                    <select id={`${formId}-repeat-end`} bind:value={repeatEndMode}>
                                        <option value="never">never</option>
                                        <option value="until">until date</option>
                                        <option value="count">after N times</option>
                                    </select>

                                    {#if repeatEndMode === 'until'}
                                        <input type="datetime-local" bind:value={repeatUntilLocal} />
                                    {:else if repeatEndMode === 'count'}
                                        <input class="num" type="number" min="1" max="9999" bind:value={repeatCount} />
                                    {/if}
                                </div>
                            </div>

                            <div class="repeatHint">
                                Start is the saved moment date. For month/year, “On day” defines what happens when that day doesn’t exist.
                            </div>
                        </div>
                    {/if}
                </div>

                <!-- Sign  -->
                <div class="row">
                    <div class="rowLine">
                        <!-- Group 1: Sign -->
                        <div class="segGroup">
                            <div class="segLabel">Sign</div>
                            <button type="button" class="segBtn" on:click={toggleEmojiAccordion} aria-expanded={emojiOpen}>
                                <span class="segEmoji">{emoji || '📍'}</span>
                                <span class="segCaret">{emojiOpen ? '▴' : '▾'}</span>
                            </button>
                        </div>
                    </div>

                    <!-- Accordion -->
                    {#if emojiOpen}
                        <div class="emojiAccordion" role="group" aria-label="Sign picker">
                            <div class="emojiTop">
                                <input
                                        class="emojiInput"
                                        value={emoji}
                                        placeholder="Paste sign (≤3 chars)…"
                                        inputmode="text"
                                        autocomplete="off"
                                        spellcheck="false"
                                        maxlength={EMOJI_MAX_LEN}
                                        on:input={onEmojiInput}
                                />
                            </div>

                            <div class="emojiGrid">
                                {#each EMOJI_PRESET as e (e)}
                                    <button
                                            type="button"
                                            class="emojiCell"
                                            class:active={emoji === e}
                                            on:click={() => pickEmoji(e)}
                                            aria-label={`Sign ${e}`}
                                            title={e}
                                    >
                                        {e}
                                    </button>
                                {/each}
                            </div>
                        </div>
                    {/if}
                </div>

                <div class="row">
                    <label for={`${formId}-title`}>Title</label>
                    <input id={`${formId}-title`} bind:value={title} placeholder="E.g. 'John HB'" />
                </div>

                <div class="row">
                    <label for={`${formId}-description`}>Description</label>
                    <textarea id={`${formId}-description`} bind:value={description} rows="4" placeholder="Notes…"></textarea>
                </div>
            </div>

            <footer class="mc-foot">
                {#if mode === 'edit'}
                    <button class="danger" on:click={remove}>Delete</button>
                {/if}
                <div class="spacer"></div>
                <button on:click={close}>Cancel</button>
                <button class="primary" on:click={save}>{mode === 'edit' ? 'Update' : 'Save'}</button>
            </footer>

            <div class="mc-hint">
                Tip: Ctrl/Cmd+Enter to save · Esc to close
            </div>
        </div>
    </Portal>
{/if}

<style>
    .mc-backdrop{
        position: fixed; inset: 0;
        border: 0;
        margin: 0;
        width: 100%;
        height: 100%;
        padding: 0;
        background: rgba(0,0,0,.45);
        z-index: 1000;
    }
    .mc-modal{
        position: fixed;
        left: 50%;
        top: 10%;
        transform: translateX(-50%);

        width: min(720px, calc(100vw - 32px)); /* чуть шире + больше safe padding */
        max-width: calc(100vw - 32px);

        background: var(--panel);
        border: 1px solid var(--panel-border);
        border-radius: 18px;
        z-index: 1001;
        overflow: hidden;
        outline: none;
        box-sizing: border-box;
    }

    .mc-head{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap: 12px;
        padding: 14px 16px;
        border-bottom: 1px solid var(--panel-border);
    }
    .mc-title{
        font-size: 18px;
        font-weight: 750;
        opacity: .95;
    }
    .mc-x{
        width: 36px;
        height: 36px;
        display: grid;
        place-items: center;
        line-height: 1;
        padding: 0;
        border-radius: 10px;
        border: 1px solid var(--panel-border);
        background: transparent;
        color: inherit;
        cursor: pointer;
    }

    .mc-body{
        padding: 14px 16px;
        display: grid;
        gap: 12px;
    }
    .row{ display: grid; gap: 6px; }

    label{
        font-size: 13px;
        opacity: .75;
    }

    input, select, textarea{
        background: color-mix(in oklab, var(--bg), transparent 10%);
        border: 1px solid var(--panel-border);
        border-radius: 12px;
        padding: 10px 12px;
        color: inherit;
        font-size: 14px;
    }
    textarea{ resize: vertical; }

    .mc-foot{
        display:flex;
        align-items:center;
        gap: 10px;
        padding: 14px 16px;
        border-top: 1px solid var(--panel-border);
    }
    .spacer{ margin-left: auto; }

    .primary{
        border: 1px solid rgba(231,231,234,0.22);
        background: rgba(231,231,234,0.10);
    }
    .danger{
        border: 1px solid rgba(231,231,234,0.18);
        background: rgba(231,231,234,0.06);
        opacity: .9;
    }

    .mc-hint{
        padding: 10px 16px 14px;
        font-size: 12px;
        opacity: .65;
    }

    @media (max-width: 520px){
        .emojiGrid{ grid-template-columns: repeat(6, 1fr); }
    }

    /* --- Row line with 2 grouped segments --- */
    .rowLine{
        display: grid;
        grid-template-columns: 1fr 1.2fr;
        gap: 12px;
        align-items: stretch;
    }

    @media (max-width: 520px){
        .rowLine{ grid-template-columns: 1fr; }
    }

    /* Reusable “segmented group” (label | value/button) */
    .segGroup{
        display: grid;
        grid-template-columns: 92px 1fr;
        border: 1px solid var(--panel-border);
        border-radius: 14px;
        overflow: hidden;
        background: color-mix(in oklab, var(--bg), transparent 10%);
    }

    .segLabel{
        display: flex;
        align-items: center;
        padding: 10px 12px;
        font-size: 13px;
        opacity: .75;
        border-right: 1px solid var(--panel-border);
        background: color-mix(in oklab, var(--panel), transparent 12%);
        white-space: nowrap;
    }

    .segValue{
        display: flex;
        align-items: center;
        padding: 10px 12px;
        font-size: 14px;
        opacity: .92;
        min-width: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .segBtn{
        display: flex;
        align-items: center;
        gap: 10px;
        justify-content: space-between;
        padding: 10px 12px;
        border: 0;
        background: transparent;
        color: inherit;
        cursor: pointer;
    }

    .segBtn:hover{
        background: color-mix(in oklab, var(--panel), var(--fg) 6%);
    }

    .segEmoji{
        font-size: 18px;
        line-height: 1;
    }

    .segCaret{
        font-size: 12px;
        opacity: .65;
    }

    /* --- Accordion (full width) --- */
    .emojiAccordion{
        margin-top: 10px;
        border: 1px solid var(--panel-border);
        border-radius: 14px;
        background: var(--panel);
        padding: 12px;
    }

    .emojiTop{
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 10px;
        align-items: center;
        margin-bottom: 10px;
    }

    .emojiInput{
        background: color-mix(in oklab, var(--bg), transparent 10%);
        border: 1px solid var(--panel-border);
        border-radius: 12px;
        padding: 10px 12px;
        color: inherit;
        font-size: 14px;
    }

    /* ограничиваем высоту именно области выбора */
    .emojiGrid{
        display: grid;
        grid-template-columns: repeat(10, 1fr);
        gap: 6px;

        max-height: 320px;   /* подбери: 280–360 обычно ок */
        overflow: auto;
        padding-right: 2px;  /* чтобы скроллбар не “ел” край */
        overscroll-behavior: contain;
    }

    /* чуть приятнее скролл на iOS/маке */
    .emojiGrid{
        -webkit-overflow-scrolling: touch;
    }

    @media (max-width: 520px){
        .emojiGrid{ grid-template-columns: repeat(8, 1fr); }
    }

    .emojiCell{
        height: 40px;              /* можно 36, но 40 чуть “дышит” */
        padding: 0;
        display: flex;
        align-items: center;
        justify-content: center;

        font-size: 18px;
        line-height: 1;            /* ключ */
        border: 1px solid transparent;
        background: transparent;
        border-radius: 10px;
        cursor: pointer;
    }

    .emojiCell:hover{
        background: color-mix(in oklab, var(--panel), var(--fg) 7%);
    }

    .emojiCell.active{
        border-color: color-mix(in oklab, var(--accent-live), var(--fg) 25%);
        background: color-mix(in oklab, var(--panel), var(--accent-live) 10%);
    }
    .mc-body, .row, .rowLine, .segGroup, .emojiAccordion, .mc-title{
        min-width: 0;
    }

    .repeatAccordion{
        margin-top: 10px;
        border: 1px solid var(--panel-border);
        border-radius: 14px;
        background: var(--panel);
        padding: 12px;
        display: grid;
        gap: 10px;
    }

    .repeatRow{
        display: grid;
        grid-template-columns: 92px 1fr;
        gap: 10px;
        align-items: center;
    }

    label.mini{
        font-size: 13px;
        opacity: .75;
        padding-left: 2px;
    }

    .repeatEvery, .repeatEnd{
        display: grid;
        grid-template-columns: 90px 1fr;
        gap: 10px;
    }

    .repeatEnd{
        grid-template-columns: 160px 1fr;
    }

    input.num{
        text-align: center;
    }

    .repeatHint{
        font-size: 12px;
        opacity: .65;
        line-height: 1.35;
    }
</style>
