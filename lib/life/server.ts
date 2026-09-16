import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { z } from 'zod';
import { categories, validDate } from './domain';
export const runtime = () => env as Cloudflare.Env & Record<string, any>;
export function bucket() { if (!env.BUCKET)
    throw new HttpError(503, 'Document storage is unavailable. Please try again.'); return env.BUCKET; }
export function db() { if (!env.DB)
    throw new Error('Database unavailable. Please try again.'); return env.DB; }
export const json = (v: unknown, s = 200) => Response.json(v, { status: s, headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
export async function authorize(request: Request) { const u = await getChatGPTUser(); if (!u)
    throw new HttpError(401, 'Sign in to continue.'); if (request.method !== 'GET') {
    const origin = request.headers.get('origin');
    if ((origin && origin !== new URL(request.url).origin) || request.headers.get('sec-fetch-site') === 'cross-site')
        throw new HttpError(403, 'This request is not allowed.');
} return u; }
export class HttpError extends Error {
    constructor(public code: number, message: string) { super(message); }
}
export function fail(e: unknown) { if (e instanceof HttpError)
    return json({ error: e.message }, e.code); if (e instanceof z.ZodError)
    return json({ error: e.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') }, 400); return json({ error: 'We could not save or load this information. Please try again.' }, 503); }
const date = z.string().refine(x => x === '' || validDate(x), 'Enter a valid calendar date.');
export const itemSchema = z.object({ id: z.string().max(80), title: z.string().trim().min(1).max(160), category: z.enum(categories), associated: z.string().max(200), provider: z.string().max(200), due: date, cost: z.string().max(20).refine(x => !x || /^\d+(\.\d{1,2})?$/.test(x), 'Enter a positive amount.'), currency: z.string().regex(/^[A-Z]{3}$/), recurrence: z.enum(['none', 'daily', 'weekly', 'monthly', 'annual']), interval: z.number().int().min(1).max(999), basis: z.enum(['calendar', 'completion']), anchor: date, reminders: z.array(z.number().int().min(0).max(3650)).max(12), notes: z.string().max(10000), checklist: z.array(z.object({ text: z.string().trim().min(1).max(500), done: z.boolean() })).max(50), status: z.enum(['active', 'completed', 'archived']), cycle: z.number().int().min(0), version: z.number().int().min(0), snooze: date, created: z.string().max(40) });
export const defaultProfile = { onboarded: false, home: 'skip', vehicle: false, pets: false, family: false, categories: [], timezone: 'America/Chicago', quietStart: 22, quietEnd: 8, reminderHour: 9, inApp: true, push: false };
export const profileSchema = z.object({ onboarded: z.boolean(), home: z.enum(['own', 'rent', 'skip']), vehicle: z.boolean(), pets: z.boolean(), family: z.boolean(), categories: z.array(z.enum(categories)), timezone: z.string().refine(v => { try {
        new Intl.DateTimeFormat('en', { timeZone: v });
        return true;
    }
    catch {
        return false;
    } }, 'Use a valid IANA time zone.'), quietStart: z.number().int().min(0).max(23), quietEnd: z.number().int().min(0).max(23), reminderHour: z.number().int().min(0).max(23), inApp: z.boolean(), push: z.boolean() });
export async function getItem(user: string, id: string) { const r = await db().prepare('SELECT data,version FROM items WHERE user=? AND id=?').bind(user, id).first<any>(); if (!r)
    throw new HttpError(404, 'Responsibility not found.'); return { ...JSON.parse(r.data), version: r.version }; }
export async function parseBody(r: Request) { if (Number(r.headers.get('content-length') || 0) > 100000)
    throw new HttpError(413, 'Request is too large.'); const s = await r.text(); if (s.length > 100000)
    throw new HttpError(413, 'Request is too large.'); try {
    return JSON.parse(s);
}
catch {
    throw new HttpError(400, 'Invalid request.');
} }
