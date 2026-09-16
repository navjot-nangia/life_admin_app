import { bucket, authorize, db, json, fail, itemSchema, profileSchema, defaultProfile, getItem, HttpError, parseBody, runtime } from '@/lib/life/server';
import { today, validDate, blankItem } from '@/lib/life/domain';
import { tick } from '@/lib/life/scheduler';
export async function GET(r: Request) { try {
    const u = await authorize(r), d = db();
    await d.prepare('INSERT OR IGNORE INTO profiles (user,data) VALUES (?,?)').bind(u.userId, JSON.stringify(defaultProfile)).run();
    await tick(d, u.userId);
    const tables = ['profiles', 'items', 'history', 'documents', 'notifications', 'dismissals'];
    const data = await Promise.all(tables.map(t => d.prepare(`SELECT * FROM ${t} WHERE user=?`).bind(u.userId).all<any>()));
    const out: any = {};
    tables.forEach((t, n) => out[t] = data[n].results.map(x => x.data ? { ...JSON.parse(x.data), ...(t === 'items' ? { version: x.version } : {}), ...(t === 'notifications' ? { read: !!x.read } : {}) } : x));
    out.notifications = out.notifications.filter((x: any) => !x.hidden);
    out.profile = out.profiles[0];
    delete out.profiles;
    out.user = { name: u.fullName || '', email: u.email };
    const heartbeat = await d.prepare("SELECT value FROM system WHERE id='scheduler'").first<any>();
    out.services = { ai: !!(runtime().AI_API_KEY && runtime().AI_MODEL), push: !!(runtime().VAPID_PUBLIC_KEY && runtime().VAPID_PRIVATE_KEY), pushKey: runtime().VAPID_PUBLIC_KEY || '', scheduler: heartbeat?.value || null };
    return json(out);
}
catch (e) {
    return fail(e);
} }
export async function POST(r: Request) {
    try {
        const u = await authorize(r), b = await parseBody(r), d = db();
        if (b.action === 'profile') {
            const p = profileSchema.parse(b.profile);
            await d.prepare('INSERT INTO profiles (user,data) VALUES (?,?) ON CONFLICT(user) DO UPDATE SET data=excluded.data').bind(u.userId, JSON.stringify(p)).run();
            return json({ ok: true });
        }
        if (b.action === 'save') {
            const i = itemSchema.parse(b.item);
            if (!i.id) {
                i.id = crypto.randomUUID();
                i.created = new Date().toISOString();
                i.anchor = i.due;
                i.version = 0;
                i.cycle = 0;
                i.status = 'active';
                await d.prepare('INSERT INTO items (id,user,data,version) VALUES (?,?,?,0)').bind(i.id, u.userId, JSON.stringify(i)).run();
            }
            else {
                const old = await getItem(u.userId, i.id);
                i.cycle = old.cycle;
                i.created = old.created;
                if (old.due !== i.due) {
                    i.anchor = i.due;
                    i.snooze = '';
                }
                i.version++;
                const res = await d.prepare('UPDATE items SET data=?,version=version+1 WHERE id=? AND user=? AND version=?').bind(JSON.stringify(i), i.id, u.userId, i.version - 1).run();
                if (!res.meta.changes)
                    throw new HttpError(409, 'This item changed in another tab. Refresh before saving.');
                if (old.due !== i.due || old.status !== i.status || old.snooze !== i.snooze)
                    await d.prepare('UPDATE notifications SET read=1,pushed=1 WHERE user=? AND item=?').bind(u.userId, i.id).run();
            }
            return json({ id: i.id });
        }
        if (b.action === 'complete') {
            const i = await getItem(u.userId, b.id);
            if (i.status !== 'active' || i.version !== b.version)
                throw new HttpError(409, 'This item has already changed. Refresh to see its current cycle.');
            if (typeof b.notes !== 'string' || b.notes.length > 5000)
                throw new HttpError(400, 'Completion notes are too long.');
            const p = await d.prepare('SELECT data FROM profiles WHERE user=?').bind(u.userId).first<any>();
            const date = today(JSON.parse(p.data).timezone);
            if (i.recurrence !== 'none' && (!validDate(b.nextDate) || b.nextDate <= date || (i.due && b.nextDate <= i.due)))
                throw new HttpError(400, 'Confirm a next date after today and the previous due date.');
            const h = { id: crypto.randomUUID(), item: i.id, title: i.title, cycle: i.cycle, due: i.due, completed: new Date().toISOString(), notes: b.notes, nextDate: i.recurrence === 'none' ? '' : b.nextDate };
            const updated = { ...i, cycle: i.cycle + 1, version: i.version + 1, status: i.recurrence === 'none' ? 'completed' : 'active', due: i.recurrence === 'none' ? i.due : b.nextDate, snooze: '', checklist: i.checklist.map((c: any) => ({ ...c, done: false })) };
            const results = await d.batch([d.prepare('INSERT INTO history (id,user,item,cycle,data) SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM items WHERE id=? AND user=? AND version=?) ON CONFLICT(item,cycle) DO NOTHING').bind(h.id, u.userId, i.id, i.cycle, JSON.stringify(h), i.id, u.userId, i.version), d.prepare('UPDATE items SET data=?,version=version+1 WHERE id=? AND user=? AND version=?').bind(JSON.stringify(updated), i.id, u.userId, i.version), d.prepare('UPDATE notifications SET read=1,pushed=1 WHERE user=? AND item=?').bind(u.userId, i.id)]);
            if (!results[1].meta.changes)
                throw new HttpError(409, 'This cycle was already completed.');
            return json({ ok: true });
        }
        if (b.action === 'dismiss') {
            if (!/^[a-z0-9-]{1,60}$/.test(b.id) || !(b.until === 'forever' || validDate(b.until)))
                throw new HttpError(400, 'Invalid suggestion.');
            await d.prepare('INSERT INTO dismissals (id,user,data) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data WHERE dismissals.user=excluded.user').bind(u.userId + ':' + b.id, u.userId, JSON.stringify({ id: b.id, until: b.until })).run();
            return json({ ok: true });
        }
        if (b.action === 'read') {
            await d.prepare('UPDATE notifications SET read=1 WHERE user=?').bind(u.userId).run();
            return json({ ok: true });
        }
        if (b.action === 'subscribe') {
            const s = b.subscription;
            if (!s || typeof s.endpoint !== 'string' || !/^https:\/\/(?:[a-z0-9-]+\.)*(?:push\.services\.mozilla\.com|fcm\.googleapis\.com|web\.push\.apple\.com|notify\.windows\.com)\//i.test(s.endpoint) || !s.keys?.p256dh || !s.keys?.auth)
                throw new HttpError(400, 'Unsupported push subscription.');
            if (JSON.stringify(s).length > 4096)
                throw new HttpError(400, 'Invalid subscription.');
            const id = u.userId + ':' + s.endpoint;
            await d.prepare('INSERT INTO subscriptions (id,user,data) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').bind(id, u.userId, JSON.stringify(s)).run();
            return json({ ok: true });
        }
        if (b.action === 'delete-account') {
            if (b.confirm !== 'DELETE')
                throw new HttpError(400, 'Type DELETE to confirm.');
            const docs = await d.prepare('SELECT id FROM documents WHERE user=?').bind(u.userId).all<any>();
            for (const doc of docs.results)
                await bucket().delete(`${u.userId}/${doc.id}`);
            await d.batch(['documents', 'history', 'items', 'notifications', 'dismissals', 'subscriptions', 'profiles'].map(t => d.prepare(`DELETE FROM ${t} WHERE user=?`).bind(u.userId)));
            return json({ ok: true });
        }
        throw new HttpError(400, 'Unknown action.');
    }
    catch (e) {
        return fail(e);
    }
}
