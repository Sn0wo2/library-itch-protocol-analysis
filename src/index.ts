import {createHmac} from 'crypto';

interface Config {
    score: number;
    nickname: string;
    deviceId: string;
    apiHost: string;
    startPath: string;
    submitPath: string;
    timeDivisor: number;
}

interface SignHeaders {
    [key: string]: string
}

interface Body {
    score: number;
    nickname: string;
    token: string;
    clientGameTime: number;
}

const config: Config = {
    score: parseInt(process.env.SCORE || process.argv[2] || '23456.789', 10),
    nickname: process.env.NICKNAME || process.argv[3] || `DeepSuck-${Math.floor(Math.random() * 9e8) + 1e8}`,
    deviceId: process.env.DEVICE_ID || process.argv[4] || `${Math.floor(Math.random() * 9e8) + 1e8}`,
    apiHost: process.env.API_HOST || 'https://api.xiaommx.cn',
    startPath: '/no-use/library-itch/start-session',
    submitPath: '/no-use/library-itch/submit-score',
    timeDivisor: parseFloat(process.env.TIME_DIVISOR || process.argv[5] || '8')
};

(async () => {
    const t1 = await fetch(`${config.apiHost}${config.startPath}`, {
        method: 'POST',
        headers: sign('POST', config.startPath, config.deviceId)
    });
    const token = (await t1.json() as { token: string }).token;
    const body: Body = {
        score: config.score,
        nickname: config.nickname,
        token,
        clientGameTime: config.score / config.timeDivisor
    };
    await progress(body.clientGameTime, 'Waiting');
    while (true) {
        try {
            const r = await fetch(`${config.apiHost}${config.submitPath}`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json', ...sign('POST', config.submitPath, config.deviceId, body)},
                body: JSON.stringify(body)
            });
            const txt = await r.text();
            if (!r.ok) throw new Error(txt);
            process.stdout.write(`\nOK: ${txt}\n`);
            break;
        } catch (e: any) {
            process.stdout.write(`\nFail: ${e.message}\n`);
            await progress(10, 'Retry in');
        }
    }
})();

function sign(method: string, path: string, deviceId: string, payload: unknown = null): SignHeaders {
    const ts = Math.floor(Date.now() / 6e4);
    const s = `${method}|${path}|${ts}|${deviceId}|${payload ? JSON.stringify(payload) : ''}`;
    return {
        'X-Auth-Hash': createHmac('md5', 'x').update(s).digest('hex'),
        'X-Timestamp': ts.toString(),
        'X-Fingerprint': deviceId
    };
}

function progress(sec: number, label: string, fps = 30): Promise<void> {
    return new Promise(res => {
        const start = Date.now(), w = 50, total = Number(sec).toFixed(1);
        let prev = 0;
        const id = setInterval(() => {
            const el = Math.min((Date.now() - start) / 1000, sec);
            const ratio = el / sec;
            const filled = Math.floor(ratio * w);
            const bar = '█'.repeat(filled) + '-'.repeat(w - filled);
            const line = `${label} [${bar}] ${el.toFixed(1)}/${total}s`;
            const pad = prev > line.length ? ' '.repeat(prev - line.length) : '';
            process.stdout.write(`\r${line}${pad}`);
            prev = line.length;
            if (el >= sec) {
                clearInterval(id);
                process.stdout.write('\n');
                res();
            }
        }, 1000 / fps);
    });
}