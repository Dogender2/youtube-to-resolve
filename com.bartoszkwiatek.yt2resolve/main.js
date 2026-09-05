// Proces główny wtyczki (Node, pełne uprawnienia).
// Odpowiada za: interfejs z Resolve (WorkflowIntegration) oraz backend pobierania (yt-dlp/ffmpeg).
// UI (renderer) rozmawia z tym plikiem wyłącznie przez IPC zdefiniowane w preload.js.
'use strict';

const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const WorkflowIntegration = require('./WorkflowIntegration.node');
const ytdlp = require('./lib/ytdlp');

const PLUGIN_ID = 'com.bartoszkwiatek.yt2resolve';

let mainWindow = null;
let resolveObj = null;

// ---------- Interfejs Resolve ----------
async function getResolve() {
    if (resolveObj) return resolveObj;
    const ok = await WorkflowIntegration.Initialize(PLUGIN_ID);
    if (!ok) throw new Error('Nie udało się zainicjować interfejsu Resolve.');
    resolveObj = await WorkflowIntegration.GetResolve();
    if (!resolveObj) throw new Error('Nie udało się pobrać obiektu Resolve.');
    return resolveObj;
}

async function getCurrentProject() {
    const resolve = await getResolve();
    const pm = await resolve.GetProjectManager();
    const proj = pm && await pm.GetCurrentProject();
    if (!proj) throw new Error('Brak otwartego projektu w Resolve.');
    return proj;
}

async function currentProjectName() {
    try {
        const proj = await getCurrentProject();
        return await proj.GetName();
    } catch {
        return null;
    }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Czeka, aż plik istnieje i jego rozmiar się ustabilizuje.
// Na Windows antywirus/OS potrafi chwilowo trzymać świeżo zapisany plik (zwłaszcza po scaleniu ffmpeg).
async function waitForStableFile(filePath, tries = 25, intervalMs = 200) {
    let lastSize = -1;
    for (let i = 0; i < tries; i++) {
        try {
            const size = fs.statSync(filePath).size;
            if (size > 0 && size === lastSize) return true; // rozmiar się nie zmienił = plik gotowy
            lastSize = size;
        } catch { /* pliku jeszcze nie ma */ }
        await sleep(intervalMs);
    }
    return fs.existsSync(filePath);
}

async function importMediaOnce(mediaPool, resolve, filePath) {
    let items = await mediaPool.ImportMedia([filePath]);
    if (!items || items.length === 0) {
        // fallback: MediaStorage.AddItemListToMediaPool
        const ms = await resolve.GetMediaStorage();
        if (ms) items = await ms.AddItemListToMediaPool([filePath]);
    }
    return Array.isArray(items) ? items.length : (items ? 1 : 0);
}

// Import pliku do bieżącego projektu (opcjonalnie do wskazanego bina).
// Import bywa zawodny tuż po pobraniu (świeży plik blokowany przez AV/OS), więc czekamy na
// stabilny plik i ponawiamy kilka razy — to eliminuje losowe "pobrano, ale nie zaimportowano".
async function importToResolve(filePath, binName) {
    const resolve = await getResolve();
    const proj = await getCurrentProject();
    const mediaPool = await proj.GetMediaPool();

    if (binName) {
        const root = await mediaPool.GetRootFolder();
        let target = null;
        const subs = (await root.GetSubFolderList()) || [];
        for (const sub of subs) {
            if ((await sub.GetName()) === binName) { target = sub; break; }
        }
        if (!target) target = await mediaPool.AddSubFolder(root, binName);
        if (target) await mediaPool.SetCurrentFolder(target);
    }

    await waitForStableFile(filePath);

    let lastErr = null;
    for (let attempt = 0; attempt < 4; attempt++) {
        try {
            const count = await importMediaOnce(mediaPool, resolve, filePath);
            if (count > 0) return count;
        } catch (err) {
            lastErr = err;
        }
        await sleep(500);
    }
    throw new Error(
        'Resolve did not import the file after several tries (antivirus lock, or path/format issue). '
        + (lastErr ? String(lastErr.message || lastErr) : ''),
    );
}

// ---------- Katalog pobierania ----------
function sanitize(s) {
    return (String(s).replace(/[\/:*?"<>|]/g, '_').trim()) || 'Projekt';
}
function defaultDownloadBase() {
    // ~/Movies na macOS, ~/Videos na Windows — Electron mapuje 'videos' na właściwy folder OS.
    try { return path.join(app.getPath('videos'), 'YouTube to Resolve'); }
    catch { return path.join(os.homedir(), 'YouTube to Resolve'); }
}
function downloadDir(projName, customBase) {
    const base = (customBase && String(customBase).trim()) ? customBase : defaultDownloadBase();
    return projName ? path.join(base, sanitize(projName)) : base;
}

// ---------- IPC ----------
function registerIpc() {
    ipcMain.handle('yt:search', async (_e, query, maxResults) => {
        return await ytdlp.search(query, maxResults || 15);
    });

    ipcMain.handle('yt:formats', async (_e, url) => {
        return await ytdlp.getFormats(url);
    });

    ipcMain.handle('app:currentProject', async () => {
        return await currentProjectName();
    });

    ipcMain.handle('app:checkTools', async () => {
        return { ytdlp: ytdlp.ytdlpPath() || null, ffmpeg: ytdlp.ffmpegPath() || null };
    });

    ipcMain.handle('app:revealFile', async (_e, filePath) => {
        if (filePath) shell.showItemInFolder(filePath);
        return true;
    });

    ipcMain.handle('app:defaultDownloadDir', () => defaultDownloadBase());

    ipcMain.handle('app:chooseFolder', async () => {
        const res = await dialog.showOpenDialog(mainWindow, {
            title: 'Choose download folder',
            properties: ['openDirectory', 'createDirectory'],
        });
        return (res.canceled || !res.filePaths || !res.filePaths[0]) ? null : res.filePaths[0];
    });

    // Pobranie + import. Postęp/wynik lecą jako zdarzenia z jobId.
    ipcMain.handle('yt:download', async (_e, job) => {
        const send = (channel, payload) => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send(channel, { jobId: job.jobId, ...payload });
            }
        };
        try {
            const projName = await currentProjectName();
            const dir = downloadDir(projName, job.downloadDir);
            const filePath = await ytdlp.download(job.url, job.spec, dir, (pu) => send('yt:progress', pu));

            let imported = 0;
            let importError = null;
            try {
                imported = await importToResolve(filePath, job.binName || '');
            } catch (err) {
                importError = String((err && err.message) || err);
            }
            send('yt:done', { filePath, imported, importError });
            return { ok: true, filePath, imported, importError };
        } catch (err) {
            const message = String((err && err.message) || err);
            send('yt:error', { message });
            return { ok: false, message };
        }
    });
}

// ---------- Okno ----------
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 460,
        height: 820,
        minWidth: 380,
        minHeight: 480,
        useContentSize: true,
        backgroundColor: '#0b0d0b',
        alwaysOnTop: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
        },
    });

    // Pływające okno NAD Resolve: nie przełącza pulpitu ani nie wyrzuca z Resolve,
    // widoczne także gdy Resolve jest na pełnym ekranie (macOS).
    mainWindow.setAlwaysOnTop(true, 'floating');
    if (process.platform === 'darwin') {
        mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    }

    mainWindow.on('close', () => {
        try { WorkflowIntegration.CleanUp(); } catch { /* ignore */ }
        app.quit();
    });

    mainWindow.loadFile('index.html');
    // Podgląd konsoli deweloperskiej (odkomentuj przy debugowaniu):
    // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
    registerIpc();
    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
