import { today, quiet } from './domain';
const encode = (v: Uint8Array) => Buffer.from(v).toString('base64url');
export async function sendWakeup(endpoint: string, publicKey: string, privateKey: string, subject: string) { const pub = Buffer.from(publicKey, 'base64url'); if (pub.length !== 65)
    throw new Error('Invalid VAPID public key'); const key = await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: encode(pub.subarray(1, 33)), y: encode(pub.subarray(33, 65)), d: privateKey, ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']); const head = Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' })).toString('base64url'); const body = Buffer.from(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 3600, sub: subject })).toString('base64url'); const unsigned = head + '.' + body; const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(unsigned))); const result = await fetch(endpoint, { method: 'POST', headers: { Authorization: `vapid t=${unsigned}.${encode(sig)}, k=${publicKey}`, TTL: '3600', 'Content-Length': '0' }, signal: AbortSignal.timeout(15000) }); return result.status; }
export async function deliver(database: D1Database, e: Record<string, any>) { if (!e.VAPID_PUBLIC_KEY || !e.VAPID_PRIVATE_KEY || !e.VAPID_SUBJECT)
    return; const pending = await database.prepare('SELECT DISTINCT user FROM notifications WHERE pushed=0 AND read=0 LIMIT 100').all<any>(); for (const row of pending.results) {
    const profile = await database.prepare('SELECT data FROM profiles WHERE user=?').bind(row.user).first<any>();
    if (!profile)
        continue;
    const p = JSON.parse(profile.data);
    if (!p.push)
        continue;
    const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: p.timezone, hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
    if (quiet(hour, p.quietStart, p.quietEnd))
        continue;
    const subscriptions = await database.prepare('SELECT * FROM subscriptions WHERE user=?').bind(row.user).all<any>();
    if (!subscriptions.results.length)
        continue;
    let sent = false;
    for (const s of subscriptions.results) {
        try {
            const status = await sendWakeup(JSON.parse(s.data).endpoint, e.VAPID_PUBLIC_KEY, e.VAPID_PRIVATE_KEY, e.VAPID_SUBJECT);
            if (status === 404 || status === 410)
                await database.prepare('DELETE FROM subscriptions WHERE id=?').bind(s.id).run();
            if (status >= 200 && status < 300)
                sent = true;
        }
        catch { /* Retry at the next scheduled run; no document or subscription logging. */ }
    }
    if (sent)
        await database.prepare('UPDATE notifications SET pushed=1 WHERE user=? AND pushed=0').bind(row.user).run();
} }
