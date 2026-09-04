// Test silnika wtyczki (Node) BEZ Resolve/Electron: wyszukiwanie, formaty, próbne pobranie.
// Uruchom:  node tools/node_smoke.js
'use strict';

const path = require('path');
const os = require('os');
const fs = require('fs');
const ytdlp = require(path.join(__dirname, '..', 'com.bartoszkwiatek.yt2resolve', 'lib', 'ytdlp'));

async function main() {
    console.log('yt-dlp :', ytdlp.ytdlpPath());
    console.log('ffmpeg :', ytdlp.ffmpegPath());
    if (!ytdlp.ytdlpPath()) {
        console.log('!! Brak yt-dlp — zainstaluj: brew install yt-dlp ffmpeg');
        return;
    }

    console.log("\n== SZUKANIE: 'lofi hip hop radio' (5) ==");
    const res = await ytdlp.search('lofi hip hop radio', 5);
    for (const r of res) {
        console.log(`  [${r.durationStr.padStart(7)}]  ${r.title.slice(0, 50).padEnd(50)}  ${r.uploader.slice(0, 18)}  ${r.id}`);
    }

    console.log("\n== FORMATY: 'Me at the zoo' ==");
    const det = await ytdlp.getFormats('https://www.youtube.com/watch?v=jNQXAC9IVRw');
    console.log(`  tytuł: ${det.title} | długość: ${det.durationStr}`);
    console.log(`  wysokości: [${det.heights.join(', ')}] | audio: ${det.hasAudio}`);

    console.log('\n== PRÓBNE POBRANIE: audio (m4a) ==');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ytr_node_'));
    const spec = { mode: 'audio', audioFormat: 'm4a' };
    const file = await ytdlp.download(
        'https://www.youtube.com/watch?v=jNQXAC9IVRw', spec, tmp,
        (p) => process.stdout.write(`\r  ${p.percentStr.padStart(8)}  ${p.speed.padStart(12)}  ETA ${p.eta.padStart(6)}   `)
    );
    console.log(`\n  OK -> ${file}`);
}

main().catch((e) => { console.error('BŁĄD:', e.message); process.exit(1); });
