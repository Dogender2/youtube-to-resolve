// Bezpieczny most między UI (renderer, sandbox) a procesem głównym.
// Renderer nie ma dostępu do Node — wszystko idzie przez to zdefiniowane API.
'use strict';

const { contextBridge, ipcRenderer } = require('electron/renderer');

contextBridge.exposeInMainWorld('api', {
    // Zapytania (żądanie -> odpowiedź)
    search: (query, maxResults) => ipcRenderer.invoke('yt:search', query, maxResults),
    getFormats: (url) => ipcRenderer.invoke('yt:formats', url),
    download: (job) => ipcRenderer.invoke('yt:download', job),
    currentProject: () => ipcRenderer.invoke('app:currentProject'),
    checkTools: () => ipcRenderer.invoke('app:checkTools'),
    revealFile: (filePath) => ipcRenderer.invoke('app:revealFile', filePath),

    // Zdarzenia strumieniowe (proces główny -> UI), rozróżniane po jobId
    onProgress: (cb) => ipcRenderer.on('yt:progress', (_e, data) => cb(data)),
    onDone: (cb) => ipcRenderer.on('yt:done', (_e, data) => cb(data)),
    onError: (cb) => ipcRenderer.on('yt:error', (_e, data) => cb(data)),
});
