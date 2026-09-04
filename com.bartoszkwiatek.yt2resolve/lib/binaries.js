// Lokalizowanie binarek yt-dlp / ffmpeg — wieloplatformowo (macOS + Windows).
// macOS: aplikacje GUI nie dziedziczą PATH z powłoki, więc sprawdzamy typowe katalogi.
// Windows: binarki mają rozszerzenie .exe; sprawdzamy też typowe lokalizacje instalatorów.
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const isWin = process.platform === 'win32';

function commonDirs() {
    if (isWin) {
        const home = os.homedir();
        const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
        const programData = process.env.PROGRAMDATA || 'C:\\ProgramData';
        return [
            path.join(localAppData, 'Microsoft', 'WinGet', 'Links'), // winget
            path.join(programData, 'chocolatey', 'bin'),             // chocolatey
            path.join(home, 'scoop', 'shims'),                       // scoop
            'C:\\ffmpeg\\bin',
        ];
    }
    return [
        '/opt/homebrew/bin', // Homebrew (Apple Silicon)
        '/usr/local/bin',    // Homebrew (Intel)
        '/opt/local/bin',    // MacPorts
        '/usr/bin',
    ];
}

// Na Windows binarka nazywa się np. "yt-dlp.exe".
function nameVariants(name) {
    return isWin ? [name + '.exe', name] : [name];
}

function isUsableFile(p) {
    try {
        if (!fs.statSync(p).isFile()) return false;
        if (isWin) return true; // na Windows nie ma bitu +x — wystarczy, że plik istnieje
        fs.accessSync(p, fs.constants.X_OK);
        return true;
    } catch {
        return false;
    }
}

// Szuka binarki: 1) dołączona do wtyczki (bundledDir), 2) PATH, 3) typowe katalogi.
function findBinary(name, bundledDir) {
    const dirs = [];
    if (bundledDir) dirs.push(bundledDir);
    const envPath = process.env.PATH || '';
    for (const d of envPath.split(path.delimiter)) if (d) dirs.push(d);
    for (const d of commonDirs()) dirs.push(d);

    for (const dir of dirs) {
        for (const variant of nameVariants(name)) {
            const p = path.join(dir, variant);
            if (isUsableFile(p)) return p;
        }
    }
    return null;
}

module.exports = { findBinary };
