import {generateKeyPairSync} from 'node:crypto';
const {privateKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
const jwk=privateKey.export({format:'jwk'});
const publicKey=Buffer.concat([Buffer.from([4]),Buffer.from(jwk.x,'base64url'),Buffer.from(jwk.y,'base64url')]).toString('base64url');
console.log('VAPID_PUBLIC_KEY='+publicKey);
console.log('VAPID_PRIVATE_KEY='+jwk.d);
console.log('Store the private key only in server secret management. Never commit it.');
