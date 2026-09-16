// Deploy in the SAME Cloudflare account as the application's database.
import { tick } from '../lib/life/scheduler';
import { deliver } from '../lib/life/push';
export default { async scheduled(_event: unknown, env: any, ctx: ExecutionContext) { ctx.waitUntil((async () => { await tick(env.DB); await deliver(env.DB, env); await env.DB.prepare("INSERT INTO system(id,value) VALUES('scheduler',?) ON CONFLICT(id) DO UPDATE SET value=excluded.value").bind(new Date().toISOString()).run(); })()); } };
