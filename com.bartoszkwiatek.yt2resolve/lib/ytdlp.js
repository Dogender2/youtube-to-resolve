// Silnik: wyszukiwanie, listowanie formatów i pobieranie z YouTube (yt-dlp jako subprocess).
// Port sprawdzonej logiki z prototypu w Pythonie — te same flagi i sposób parsowania.
'use strict';

const { spawn, execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const { findBinary } = require('./binaries');

const BUNDLED_BIN = path.join(__dirname, '..', 'bin'); // opcjonalne dołączone binarki
const ANSI = /\x1b\[[0-9;]*m/g;

let _ytdlp; // cache
let _ffmpeg;

function ytdlpPath() {
    if (_ytdlp === undefined) _ytdlp = findBinary('yt-dlp', BUNDLED_BIN);
    return _ytdlp;
}
function ffmpegPath() {
    if (_ffmpeg === undefined) _ffmpeg = findBinary('ffmpeg', BUNDLED_BIN);
    return _ffmpeg;
}
function ffmpegDir() {
    const p = ffmpegPath();
    return p ? path.dirname(p) : null;
}

function requireYtdlp() {
    const p = ytdlpPath();
    if (!p) {
        throw new Error(
            "Nie znaleziono 'yt-dlp'. Zainstaluj: brew install yt-dlp ffmpeg"
        );
    }
    return p;
}

function fmtDuration(sec) {
    if (sec == null || isNaN(sec)) return '--:--';
    sec = Math.floor(sec);
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function qualityLabel(h) {
    const map = {
        4320: '4320p (8K)', 2160: '2160p (4K)', 1440: '1440p (2K)',
        1080: '1080p (Full HD)', 720: '720p (HD)', 480: '480p',
        360: '360p', 240: '240p', 144: '144p',
    };
    return map[h] || `${h}p`;
}

// Uruchamia binarkę i zbiera całe wyjście (dla szybkich poleceń: search, -J).
function runCollect(bin, args) {
    return new Promise((resolve) => {
        execFile(bin, args, { maxBuffer: 64 * 1024 * 1024 }, (err, stdout, stderr) => {
            resolve({
                code: err ? (typeof err.code === 'number' ? err.code : 1) : 0,
                stdout: stdout || '',
                stderr: stderr || '',
            });
        });
    });
}

async function search(query, maxResults = 15) {
    const yt = requireYtdlp();
    const args = [
        `ytsearch${maxResults}:${query}`,
        '--flat-playlist', '--dump-json',
        '--no-warnings', '--ignore-errors',
    ];
    const { stdout } = await runCollect(yt, args);
    const results = [];
    for (const line of stdout.split('\n')) {
        const s = line.trim();
        if (!s) continue;
        let d;
        try { d = JSON.parse(s); } catch { continue; }
        const id = d.id || '';
        results.push({
            id,
            title: d.title || '(bez tytułu)',
            url: d.url || (id ? `https://www.youtube.com/watch?v=${id}` : ''),
            duration: d.duration ?? null,
            durationStr: fmtDuration(d.duration),
            uploader: d.channel || d.uploader || '',
            thumbnail: id ? `https://i.ytimg.com/vi/${id}/mqdefault.jpg` : '',
        });
    }
    return results;
}

async function getFormats(url) {
    const yt = requireYtdlp();
    const { code, stdout, stderr } = await runCollect(yt, ['-J', '--no-warnings', '--no-playlist', url]);
    if (code !== 0 || !stdout.trim()) {
        throw new Error(`Nie udało się pobrać formatów: ${stderr.slice(0, 300)}`);
    }
    const data = JSON.parse(stdout);
    const heights = new Set();
    let hasAudio = false;
    for (const f of (data.formats || [])) {
        if (f.vcodec && f.vcodec !== 'none' && f.height) heights.add(f.height);
        if (f.acodec && f.acodec !== 'none') hasAudio = true;
    }
    const id = data.id || '';
    return {
        id,
        title: data.title || '(bez tytułu)',
        duration: data.duration ?? null,
        durationStr: fmtDuration(data.duration),
        uploader: data.channel || data.uploader || '',
        thumbnail: id ? `https://i.ytimg.com/vi/${id}/mqdefault.jpg` : '',
        heights: [...heights].sort((a, b) => b - a),
        hasAudio,
    };
}

function buildFormatArgs(spec) {
    if (spec.mode === 'audio') {
        return ['-f', 'bestaudio/best', '-x', '--audio-format', spec.audioFormat || 'm4a', '--audio-quality', '0'];
    }
    const h = spec.height || 1080;
    return ['-f', `bv*[height<=${h}]+ba/b[height<=${h}]/b`, '--merge-output-format', spec.container || 'mp4'];
}

function parseProgress(line) {
    const parts = line.split('@@P@@');
    if (parts.length < 2) return null;
    const seg = parts[1].split('|');
    const pct = (seg[0] || '').trim();
    const speed = (seg[1] || '').trim();
    const eta = (seg[2] || '').trim();
    const m = pct.match(/([\d.]+)\s*%/);
    return { percent: m ? parseFloat(m[1]) : null, percentStr: pct, speed, eta };
}

// Dzieli strumień na linie (osobny bufor na stdout i stderr, żeby się nie mieszały).
function lineSplitter(onLine) {
    let buf = '';
    return (chunk) => {
        buf += chunk.toString();
        let i;
        while ((i = buf.indexOf('\n')) >= 0) {
            onLine(buf.slice(0, i));
            buf = buf.slice(i + 1);
        }
    };
}

// Buduje wspólne argumenty dla jednego podejścia pobierania.
function buildDownloadArgs(outtmpl, extraArgs) {
    // UWAGA: samo --print wycisza yt-dlp; --progress + --no-simulate przywraca postęp.
    const args = [
        '--no-warnings', '--newline', '--no-playlist', '--no-simulate', '--progress',
        '--retries', '10', '--fragment-retries', '10', '--extractor-retries', '3',
        '-o', outtmpl,
        '--progress-template',
        'download:@@P@@%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s',
        '--print', 'after_move:@@FILE@@%(filepath)s',
    ];
    const fdir = ffmpegDir();
    if (fdir) args.push('--ffmpeg-location', fdir);
    if (extraArgs) args.push(...extraArgs);
    return args;
}

function looksLike403(text) {
    return /403|forbidden|unable to download video data/i.test(text || '');
}

// Jedno uruchomienie yt-dlp. Zwraca Promise<{ code, finalPath, tail }>.
function runYtdlpOnce(yt, args, onProgress) {
    return new Promise((resolve, reject) => {
        let finalPath = null;
        const tail = [];
        const onLine = (raw) => {
            const line = raw.replace(ANSI, '');
            if (line.startsWith('@@FILE@@')) {
                finalPath = line.slice('@@FILE@@'.length).trim();
            } else if (line.includes('@@P@@')) {
                const pu = parseProgress(line);
                if (pu && onProgress) onProgress(pu);
            } else if (line.trim()) {
                tail.push(line.trim());
                if (tail.length > 8) tail.shift();
            }
        };
        const child = spawn(yt, args);
        child.stdout.on('data', lineSplitter(onLine));
        child.stderr.on('data', lineSplitter(onLine));
        child.on('error', (err) => reject(err));
        child.on('close', (code) => resolve({ code, finalPath, tail: tail.join(' | ') }));
    });
}

// Pobiera do destDir. onProgress({percent,percentStr,speed,eta}). Zwraca Promise<ścieżka pliku>.
async function download(url, spec, destDir, onProgress) {
    const yt = requireYtdlp();
    fs.mkdirSync(destDir, { recursive: true });
    const outtmpl = path.join(destDir, '%(title).150B [%(id)s].%(ext)s');
    const formatArgs = buildFormatArgs(spec);

    let res = await runYtdlpOnce(yt, [...buildDownloadArgs(outtmpl, null), ...formatArgs, url], onProgress);

    // Częsty workaround na HTTP 403: wymuś inny klient odtwarzacza YouTube i spróbuj jeszcze raz.
    if (res.code !== 0 && looksLike403(res.tail)) {
        const extra = ['--extractor-args', 'youtube:player_client=web_safari,tv,web'];
        res = await runYtdlpOnce(yt, [...buildDownloadArgs(outtmpl, extra), ...formatArgs, url], onProgress);
    }

    if (res.code !== 0) {
        if (looksLike403(res.tail)) {
            throw new EngineError('HTTP 403 Forbidden — yt-dlp is out of date. Update it (see README) and try again.');
        }
        throw new EngineError(`yt-dlp exited with code ${res.code}. ${res.tail}`);
    }
    if (!res.finalPath) {
        throw new EngineError('Downloaded, but could not determine the output file path.');
    }
    return res.finalPath;
}

module.exports = {
    search, getFormats, download, buildFormatArgs,
    ytdlpPath, ffmpegPath, ffmpegDir, qualityLabel, fmtDuration,
};
