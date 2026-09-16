import { today, days, quiet, eligibleReminderDate, reminderStage, type Item } from './domain';
export async function tick(database: D1Database, user?: string, now = new Date()) {
    const profiles = await database.prepare(user ? 'SELECT * FROM profiles WHERE user=?' : 'SELECT * FROM profiles').bind(...(user ? [user] : [])).all<any>();
    let count = 0;
    for (const row of profiles.results) {
        const p = JSON.parse(row.data);
        if (!p.inApp)
            continue;
        const date = today(p.timezone, now), eligible = eligibleReminderDate(p, now);
        if (!eligible)
            continue;
        const items = await database.prepare('SELECT data FROM items WHERE user=?').bind(row.user).all<any>();
        for (const record of items.results) {
            const i: Item = JSON.parse(record.data), stage = reminderStage(i, eligible);
            if (stage === null)
                continue;
            const key = `${i.id}:${i.cycle}:${i.due}:${i.snooze || "original"}:${stage}`;
            const remaining = days(i.due, date);
            const text = remaining < 0 ? `${i.title} is overdue.` : remaining <= 7 ? `${i.title}: ready to handle this? Open your checklist.` : `${i.title}: review your records and prepare for the deadline.`;
            const result = await database.prepare('INSERT OR IGNORE INTO notifications (id,user,item,data,read,pushed) VALUES (?,?,?,?,0,0)').bind(key, row.user, i.id, JSON.stringify({ id: key, item: i.id, title: i.title, text, created: now.toISOString(), date: i.due })).run();
            count += result.meta.changes;
            // Older stages are superseded, including reminder offsets that passed before creation.
            for (const offset of i.reminders.filter(n => n > stage))
                await database.prepare('INSERT OR IGNORE INTO notifications (id,user,item,data,read,pushed) VALUES (?,?,?,?,1,1)').bind(`${i.id}:${i.cycle}:${i.due}:${i.snooze || "original"}:${offset}`, row.user, i.id, JSON.stringify({ hidden: true })).run();
        }
    }
    return count;
}
