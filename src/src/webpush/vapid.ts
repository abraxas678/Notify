import type { JWK } from "./jwk";
import { arrayBufferToBase64, b64ToUrlEncoded, exportPublicKeyPair, stringToU8Array } from "./util";

const objToUrlB64 = (obj: object) => b64ToUrlEncoded(btoa(JSON.stringify(obj)));

async function signData(token: string, applicationKeys: any): Promise<string> {
    const key = await crypto.subtle.importKey('jwk',
        applicationKeys,
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['sign']);

    const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: { name: 'SHA-256' } },
        key,
        stringToU8Array(token));

    return b64ToUrlEncoded(arrayBufferToBase64(sig));
}

async function generateHeaders(endpoint: string, applicationServerKeys: JWK, sub: string): Promise<{ token: string, serverKey: string }> {
    const publicKey = b64ToUrlEncoded(exportPublicKeyPair(applicationServerKeys));
    const pushService = new URL(endpoint);

    const header = {
        "typ": "JWT",
        "alg": "ES256"
    }

    const body = {
        "aud": `${pushService.protocol}//${pushService.host}`,
        "exp": `${Math.floor(Date.now() / 1000) + (12 * 60 * 60)}`,
        "sub": sub
    }

    const unsignedToken = objToUrlB64(header) + "." + objToUrlB64(body);
    const signature = await signData(unsignedToken, applicationServerKeys);

    return {
        token: `${unsignedToken}.${signature}`,
        serverKey: publicKey
    }
}

export async function generateV1Headers(endpoint: string, applicationServerKeys: JWK, sub: string): Promise<{ [headerName: string]: string }> {
    const headers = await generateHeaders(endpoint, applicationServerKeys, sub);
    return {
        'Authorization': `WebPush ${headers.token}`,
        'Crypto-Key': `p256ecdsa=${headers.serverKey}`,
    };
}

export async function generateV2Headers(endpoint: string, applicationServerKeys: JWK, sub: string): Promise<{ [headerName: string]: string }> {
    const headers = await generateHeaders(endpoint, applicationServerKeys, sub);
    return {
        'Authorization': `vapid t=${headers.token}, k=${headers.serverKey}`,
    };
}
