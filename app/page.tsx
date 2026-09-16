import { getChatGPTUser, chatGPTSignInPath } from './chatgpt-auth';
import LifeApp from './life-app';
export const dynamic = 'force-dynamic';
export default async function Page() { const user = await getChatGPTUser(); return <LifeApp signedIn={!!user} signInUrl={chatGPTSignInPath('/')}/>; }
