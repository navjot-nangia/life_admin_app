import { bucket, authorize, db, json, fail, HttpError, runtime, parseBody } from '@/lib/life/server';
import { AnthropicProvider } from '@/lib/life/ai';
export async function POST(r: Request) { try {
    const u = await authorize(r), b = await parseBody(r);
    if (b.consent !== true)
        throw new HttpError(400, 'Consent is required before sending this document to Anthropic.');
    const e = runtime();
    if (!e.AI_API_KEY || !e.AI_MODEL)
        throw new HttpError(503, 'AI extraction is not configured. You can still upload documents and enter details manually.');
    const doc = await db().prepare('SELECT * FROM documents WHERE id=? AND user=?').bind(b.id, u.userId).first<any>();
    if (!doc)
        throw new HttpError(404, 'Document not found.');
    if (doc.size > 5 * 1024 * 1024)
        throw new HttpError(400, 'For extraction, use a document up to 5 MB. Upload only the relevant pages.');
    const object = await bucket().get(`${u.userId}/${doc.id}`);
    if (!object)
        throw new HttpError(404, 'Document not found.');
    try {
        return json(await new AnthropicProvider(e.AI_API_KEY, e.AI_MODEL).extract(await object.arrayBuffer(), doc.type));
    }
    catch {
        throw new HttpError(503, 'Extraction was unavailable or returned unreadable information. Your document is saved; enter details manually.');
    }
}
catch (e) {
    return fail(e);
} }
