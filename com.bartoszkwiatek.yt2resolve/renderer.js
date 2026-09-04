// Logika interfejsu (renderer, sandbox). Rozmawia z backendem tylko przez window.api (preload.js).
'use strict';

// ---------- i18n ----------
const I18N = {
    en: {
        searchPh: 'Search YouTube…',
        searchBtn: 'Search',
        binLabel: 'Import to bin:',
        binPh: '(current bin)',
        filesHint: 'Files go to your Videos/Movies folder → YouTube to Resolve',
        emptyState: 'Type a query and hit Search to see YouTube results.',
        legal: 'Only download material you have the rights to (your own, Creative Commons, licensed).',
        projectPrefix: 'Project: ',
        projectNone: '— (none)',
        toolsOk: 'tools OK',
        toolsMissing: 'tools missing!',
        searching: 'Searching…',
        searchError: 'Search error: ',
        noResults: 'No results.',
        loadingFormats: 'Loading formats…',
        formatsError: 'Could not fetch formats: ',
        video: 'Video',
        audio: 'Audio',
        quality: 'Quality',
        container: 'Container',
        format: 'Format',
        download: 'Download',
        liveNote: 'Note: no duration — this may be a live stream.',
        starting: 'Starting…',
        downloading: 'Downloading…',
        added: '✓ Added to project',
        importFailed: 'Downloaded, but import failed: ',
        errorPrefix: 'Error: ',
        unknown: 'unknown',
        showFile: 'Show file',
    },
    pl: {
        searchPh: 'Szukaj na YouTube…',
        searchBtn: 'Szukaj',
        binLabel: 'Importuj do bina:',
        binPh: '(bieżący bin)',
        filesHint: 'Pliki trafiają do folderu Wideo/Filmy → YouTube to Resolve',
        emptyState: 'Wpisz zapytanie i naciśnij Szukaj, aby zobaczyć wyniki z YouTube.',
        legal: 'Pobieraj wyłącznie materiały, do których masz prawa (własne, Creative Commons, licencjonowane).',
        projectPrefix: 'Projekt: ',
        projectNone: '— (brak)',
        toolsOk: 'narzędzia OK',
        toolsMissing: 'brak narzędzi!',
        searching: 'Szukam…',
        searchError: 'Błąd wyszukiwania: ',
        noResults: 'Brak wyników.',
        loadingFormats: 'Ładowanie formatów…',
        formatsError: 'Nie udało się pobrać formatów: ',
        video: 'Wideo',
        audio: 'Audio',
        quality: 'Jakość',
        container: 'Kontener',
        format: 'Format',
        download: 'Pobierz',
        liveNote: 'Uwaga: brak długości — to może być transmisja na żywo.',
        starting: 'Rozpoczynanie…',
        downloading: 'Pobieranie…',
        added: '✓ Dodano do projektu',
        importFailed: 'Pobrano, ale import się nie udał: ',
        errorPrefix: 'Błąd: ',
        unknown: 'nieznany',
        showFile: 'Pokaż plik',
    },
};
const LANG_KEY = 'yt2resolve.lang';
let currentLang = 'en';

function loadLang() {
    try {
        const v = localStorage.getItem(LANG_KEY);
        if (v === 'en' || v === 'pl') return v;
    } catch { /* localStorage niedostępny */ }
    return 'en';
}
function saveLang(lang) {
    try { localStorage.setItem(LANG_KEY, lang); } catch { /* ignore */ }
}
function t(key) {
    return (I18N[currentLang] && I18N[currentLang][key]) || I18N.en[key] || key;
}

// ---------- Dane / stałe ----------
const jobs = new Map(); // jobId -> { fill, pctText, info, panel, item }
let lastResults = null; // ostatnie wyniki (do ponownego renderu przy zmianie języka)

const AUDIO_FORMATS = [
    ['m4a', 'M4A (AAC)'],
    ['mp3', 'MP3'],
    ['opus', 'Opus'],
    ['wav', 'WAV'],
    ['flac', 'FLAC'],
];
const CONTAINERS = [['mp4', 'MP4'], ['mkv', 'MKV']];

const DL_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v11"/><path d="M7 10l5 5 5-5"/><path d="M5 20h14"/></svg>';

function qualityLabel(h) {
    const m = {
        4320: '4320p (8K)', 2160: '2160p (4K)', 1440: '1440p (2K)',
        1080: '1080p (Full HD)', 720: '720p (HD)', 480: '480p',
        360: '360p', 240: '240p', 144: '144p',
    };
    return m[h] || `${h}p`;
}

// Mały helper do budowy elementów DOM.
function el(tag, props, ...kids) {
    const e = document.createElement(tag);
    if (props) {
        for (const [k, v] of Object.entries(props)) {
            if (v == null) continue;
            if (k === 'class') e.className = v;
            else if (k === 'html') e.innerHTML = v;
            else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
            else e.setAttribute(k, v);
        }
    }
    for (const kid of kids.flat()) {
        if (kid == null) continue;
        e.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    return e;
}

const byId = (id) => document.getElementById(id);

// ---------- Język ----------
function applyStaticI18n() {
    document.documentElement.lang = currentLang;
    document.querySelectorAll('[data-i18n]').forEach((node) => {
        node.textContent = t(node.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-ph]').forEach((node) => {
        node.placeholder = t(node.dataset.i18nPh);
    });
}
function updateLangButtons() {
    document.querySelectorAll('#langSwitch .lang-btn').forEach((b) => {
        b.classList.toggle('active', b.dataset.lang === currentLang);
    });
}
function setLanguage(lang) {
    if (lang !== 'en' && lang !== 'pl') return;
    currentLang = lang;
    saveLang(lang);
    updateLangButtons();
    applyStaticI18n();
    refreshProject();
    refreshTools();
    // Odśwież wyniki (przetłumacz przyciski/panele), o ile nic się nie pobiera.
    if (Array.isArray(lastResults) && jobs.size === 0) renderResults(lastResults);
}

// ---------- Start ----------
async function init() {
    currentLang = loadLang();
    updateLangButtons();
    applyStaticI18n();

    document.querySelectorAll('#langSwitch .lang-btn').forEach((b) => {
        b.addEventListener('click', () => setLanguage(b.dataset.lang));
    });

    byId('searchBtn').addEventListener('click', doSearch);
    byId('searchInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });

    window.api.onProgress(onProgress);
    window.api.onDone(onDone);
    window.api.onError(onError);

    refreshProject();
    refreshTools();
}

async function refreshProject() {
    try {
        const name = await window.api.currentProject();
        const chip = byId('projectChip');
        chip.textContent = t('projectPrefix') + (name || t('projectNone'));
        chip.classList.toggle('chip-ok', !!name);
        chip.classList.toggle('chip-err', !name);
    } catch { /* ignore */ }
}

async function refreshTools() {
    try {
        const info = await window.api.checkTools();
        const ok = !!(info.ytdlp && info.ffmpeg);
        const chip = byId('toolsChip');
        chip.textContent = ok ? t('toolsOk') : t('toolsMissing');
        chip.classList.toggle('chip-ok', ok);
        chip.classList.toggle('chip-err', !ok);
        chip.title = `yt-dlp: ${info.ytdlp || '—'}\nffmpeg: ${info.ffmpeg || '—'}`;
    } catch { /* ignore */ }
}

// ---------- Wyszukiwanie ----------
let searching = false;
async function doSearch() {
    const q = byId('searchInput').value.trim();
    if (!q || searching) return;
    searching = true;
    const results = byId('results');
    results.replaceChildren(el('div', { class: 'empty' }, t('searching')));
    try {
        const list = await window.api.search(q, 15);
        renderResults(list);
    } catch (err) {
        lastResults = null;
        results.replaceChildren(el('div', { class: 'empty error' }, t('searchError') + (err.message || err)));
    } finally {
        searching = false;
    }
}

function renderResults(list) {
    lastResults = list;
    const results = byId('results');
    if (!list || !list.length) {
        results.replaceChildren(el('div', { class: 'empty' }, t('noResults')));
        return;
    }
    results.replaceChildren(...list.map(createRow));
}

function createRow(item) {
    const thumb = el('div', { class: 'thumb' });
    if (item.thumbnail) {
        const img = el('img', { src: item.thumbnail, loading: 'lazy', referrerpolicy: 'no-referrer', alt: '' });
        img.addEventListener('error', () => { thumb.classList.add('thumb-empty'); img.remove(); });
        thumb.append(img);
    } else {
        thumb.classList.add('thumb-empty');
    }
    if (item.durationStr && item.durationStr !== '--:--') {
        thumb.append(el('span', { class: 'badge' }, item.durationStr));
    }

    const body = el('div', { class: 'r-body' },
        el('div', { class: 'r-title' }, item.title),
        el('div', { class: 'r-meta' }, item.uploader || ''));

    const dlBtn = el('button', { class: 'icon-btn', title: t('download'), html: DL_ICON });
    const panel = el('div', { class: 'r-panel' });
    const row = el('div', { class: 'row' },
        el('div', { class: 'r-head' }, thumb, body, el('div', { class: 'r-action' }, dlBtn)),
        panel);

    dlBtn.addEventListener('click', () => toggleOptions(row, item, panel));
    return row;
}

// ---------- Panel wyboru formatu ----------
async function toggleOptions(row, item, panel) {
    if (panel.classList.contains('open')) {
        panel.classList.remove('open');
        panel.replaceChildren();
        return;
    }
    document.querySelectorAll('.r-panel.open').forEach((p) => {
        if (p !== panel) { p.classList.remove('open'); p.replaceChildren(); }
    });
    panel.classList.add('open');
    panel.replaceChildren(el('div', { class: 'loading' }, t('loadingFormats')));
    try {
        const det = await window.api.getFormats(item.url);
        buildOptions(row, item, panel, det);
    } catch (err) {
        panel.replaceChildren(el('div', { class: 'err-line' }, t('formatsError') + (err.message || err)));
    }
}

function buildOptions(row, item, panel, det) {
    const hasVideo = det.heights && det.heights.length > 0;
    const state = { mode: hasVideo ? 'video' : 'audio' };

    const segVideo = el('button', { class: 'seg' }, t('video'));
    const segAudio = el('button', { class: 'seg' }, t('audio'));
    if (!hasVideo) segVideo.setAttribute('disabled', '');
    const segmented = el('div', { class: 'segmented' }, segVideo, segAudio);

    const qSel = el('select', null, ...det.heights.map((h) => el('option', { value: String(h) }, qualityLabel(h))));
    const cSel = el('select', null, ...CONTAINERS.map(([v, l]) => el('option', { value: v }, l)));
    const aSel = el('select', null, ...AUDIO_FORMATS.map(([v, l]) => el('option', { value: v }, l)));

    const qField = el('label', { class: 'field' }, el('span', null, t('quality')), qSel);
    const cField = el('label', { class: 'field' }, el('span', null, t('container')), cSel);
    const aField = el('label', { class: 'field' }, el('span', null, t('format')), aSel);

    const dlBtn = el('button', { class: 'btn btn-primary' }, t('download'));
    const controls = el('div', { class: 'controls' },
        segmented, el('div', { class: 'fields' }, qField, cField, aField), dlBtn);

    const note = (item.duration == null)
        ? el('div', { class: 'note' }, t('liveNote'))
        : null;

    panel.replaceChildren(controls, ...(note ? [note] : []));

    function applyMode() {
        const video = state.mode === 'video';
        segVideo.classList.toggle('active', video);
        segAudio.classList.toggle('active', !video);
        qField.style.display = video ? '' : 'none';
        cField.style.display = video ? '' : 'none';
        aField.style.display = video ? 'none' : '';
    }
    segVideo.addEventListener('click', () => { if (hasVideo) { state.mode = 'video'; applyMode(); } });
    segAudio.addEventListener('click', () => { state.mode = 'audio'; applyMode(); });
    applyMode();

    dlBtn.addEventListener('click', () => {
        const spec = state.mode === 'video'
            ? { mode: 'video', height: parseInt(qSel.value, 10), container: cSel.value }
            : { mode: 'audio', audioFormat: aSel.value };
        startDownload(item, panel, spec);
    });
}

// ---------- Pobieranie + postęp ----------
function startDownload(item, panel, spec) {
    const jobId = 'job_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);

    const fill = el('div', { class: 'bar-fill' });
    const pctText = el('span', { class: 'p-pct' }, '0%');
    const info = el('span', { class: 'p-info' }, t('starting'));
    panel.replaceChildren(el('div', { class: 'progress-active' },
        el('div', { class: 'p-head' }, pctText, info),
        el('div', { class: 'bar' }, fill)));

    jobs.set(jobId, { fill, pctText, info, panel, item });

    const binName = byId('binInput').value.trim();
    window.api.download({ jobId, url: item.url, spec, binName }).catch(() => { /* obsłużone przez onError */ });
}

function onProgress(d) {
    const j = jobs.get(d.jobId);
    if (!j) return;
    if (typeof d.percent === 'number') {
        j.fill.style.width = Math.min(100, d.percent) + '%';
        j.pctText.textContent = (d.percentStr || '').trim() || Math.round(d.percent) + '%';
    }
    const parts = [];
    if (d.speed) parts.push(d.speed);
    if (d.eta && d.eta !== 'NA') parts.push('ETA ' + d.eta);
    j.info.textContent = parts.join('  •  ') || t('downloading');
}

function onDone(d) {
    const j = jobs.get(d.jobId);
    if (!j) return;
    j.fill.style.width = '100%';
    const reveal = revealLink(d.filePath);
    const doneEl = d.importError
        ? el('div', { class: 'done warn' }, el('span', null, t('importFailed') + d.importError), reveal)
        : el('div', { class: 'done ok' }, el('span', null, t('added')), reveal);
    j.panel.replaceChildren(doneEl);
    jobs.delete(d.jobId);
}

function onError(d) {
    const j = jobs.get(d.jobId);
    if (!j) return;
    j.panel.replaceChildren(el('div', { class: 'done err' }, t('errorPrefix') + (d.message || t('unknown'))));
    jobs.delete(d.jobId);
}

function revealLink(filePath) {
    const b = el('button', { class: 'link' }, t('showFile'));
    b.addEventListener('click', () => window.api.revealFile(filePath));
    return b;
}

window.addEventListener('DOMContentLoaded', init);
