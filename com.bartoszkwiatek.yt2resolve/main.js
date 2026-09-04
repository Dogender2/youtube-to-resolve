// Proces główny wtyczki (Node, pełne uprawnienia).
// Odpowiada za: interfejs z Resolve (WorkflowIntegration) oraz backend pobierania (yt-dlp/ffmpeg).
// UI (renderer) rozmawia z tym plikiem wyłącznie przez IPC zdefiniowane w preload.js.
'use strict';

const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const os = require('os');
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

// Import pliku do bieżącego projektu (opcjonalnie do wskazanego bina).
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

    // Preferujemy ImportMedia; w razie czego próbujemy MediaStorage.AddItemListToMediaPool.
    let items = await mediaPool.ImportMedia([filePath]);
    if (!items || items.length === 0) {
        const ms = await resolve.GetMediaStorage();
        if (ms) items = await ms.AddItemListToMediaPool([filePath]);
    }
    const count = Array.isArray(items) ? items.length : (items ? 1 : 0);
    if (count === 0) throw new Error('Resolve nie zaimportował pliku (format lub ścieżka?).');
    return count;
}

// ---------- Katalog pobierania ----------
function sanitize(s) {
    return (String(s).replace(/[\/:*?"<>|]/g, '_').trim()) || 'Projekt';
}
function downloadDir(projName) {
    // ~/Movies na macOS, ~/Videos na Windows — Electron mapuje 'videos' na właściwy folder OS.
    let root;
    try { root = app.getPath('videos'); } catch { root = os.homedir(); }
    let base = path.join(root, 'YouTube to Resolve');
    if (projName) base = path.join(base, sanitize(projName));
    return base;
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

    // Pobranie + import. Postęp/wynik lecą jako zdarzenia z jobId.
    ipcMain.handle('yt:download', async (_e, job) => {
        const send = (channel, payload) => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send(channel, { jobId: job.jobId, ...payload });
            }
        };
        try {
            const projName = await currentProjectName();
            const dir = downloadDir(projName);
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
        backgroundColor: '#1b1b1d',
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
