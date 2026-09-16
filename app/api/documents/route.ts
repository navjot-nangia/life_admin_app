import { bucket, authorize, db, json, fail, getItem, HttpError, runtime } from '@/lib/life/server';
export async function GET(r: Request) { try {
    const u = await authorize(r), id = new URL(r.url).searchParams.get('id');
    const doc = await db().prepare('SELECT * FROM documents WHERE id=? AND user=?').bind(id, u.userId).first<any>();
    if (!doc)
        throw new HttpError(404, 'Document not found.');
    const o = await bucket().get(`${u.userId}/${doc.id}`);
    if (!o)
        throw new HttpError(404, 'Document not found.');
    return new Response(o.body, { headers: { 'Content-Type': doc.type, 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(doc.name)}`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox" } });
}
catch (e) {
    return fail(e);
} }
export async function POST(r: Request) { try {
    const u = await authorize(r);
    if (Number(r.headers.get('content-length') || 0) > 11 * 1024 * 1024)
        throw new HttpError(413, 'Choose a file smaller than 10 MB.');
    const reader = r.body?.getReader();
    if (!reader)
        throw new HttpError(400, 'No file received.');
    let total = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
        const { done, value } = await reader.read();
        if (done)
            break;
        total += value.length;
        if (total > 11 * 1024 * 1024) {
            await reader.cancel();
            throw new HttpError(413, 'Choose a file smaller than 10 MB.');
        }
        chunks.push(value);
    }
    const payload = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
        payload.set(chunk, offset);
        offset += chunk.length;
    }
    const f = await new Response(payload, { headers: { 'Content-Type': r.headers.get('content-type') || '' } }).formData(), file = f.get('file');
    if (!(file instanceof File) || file.size === 0 || file.size > 10 * 1024 * 1024)
        throw new HttpError(400, 'Choose a PDF, JPG, or PNG up to 10 MB.');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 ? 'application/pdf' : bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff ? 'image/jpeg' : bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71 && bytes[4] === 13 && bytes[5] === 10 && bytes[6] === 26 && bytes[7] === 10 ? 'image/png' : null;
    if (!type || type !== file.type)
        throw new HttpError(400, 'File contents must match PDF, JPG, or PNG format.');
    const item = String(f.get('item') || '');
    if (item)
        await getItem(u.userId, item);
    const id = crypto.randomUUID(), name = file.name.replace(/[\x00-\x1f]/g, '').slice(0, 200), created = new Date().toISOString();
    await bucket().put(`${u.userId}/${id}`, bytes, { httpMetadata: { contentType: type } });
    try {
        await db().prepare('INSERT INTO documents (id,user,item,name,type,size,created) VALUES (?,?,?,?,?,?,?)').bind(id, u.userId, item, name, type, file.size, created).run();
    }
    catch (e) {
        await bucket().delete(`${u.userId}/${id}`);
        throw e;
    }
    return json({ id, name, type, size: file.size, item, created });
}
catch (e) {
    return fail(e);
} }
export async function PATCH(r: Request) { try {
    const u = await authorize(r), b: any = await r.json();
    await getItem(u.userId, b.item);
    const result = await db().prepare('UPDATE documents SET item=? WHERE id=? AND user=?').bind(b.item, b.id, u.userId).run();
    if (!result.meta.changes)
        throw new HttpError(404, 'Document not found.');
    return json({ ok: true });
}
catch (e) {
    return fail(e);
} }
export async function DELETE(r: Request) { try {
    const u = await authorize(r), id = new URL(r.url).searchParams.get('id');
    const doc = await db().prepare('SELECT id FROM documents WHERE id=? AND user=?').bind(id, u.userId).first<any>();
    if (!doc)
        throw new HttpError(404, 'Document not found.');
    await bucket().delete(`${u.userId}/${doc.id}`);
    await db().prepare('DELETE FROM documents WHERE id=? AND user=?').bind(id, u.userId).run();
    return json({ ok: true });
}
catch (e) {
    return fail(e);
} }
