
import { Elysia } from 'elysia';
import { CryptoService } from './crypto.service';

// Initialize keys immediately
CryptoService.initialize();

export const encryptionMiddleware = (app: Elysia) =>
    app
        .derive(({ request, body, headers, set }) => {
            // Check if request is encrypted
            let encryptedKey = '';
            let payload: any = null;

            // Debug Log
            // console.log(`[CryptoMiddleware] Processing ${request.method} ${request.url}`);

            // 1. Try Body (POST/PUT) - Expecting Base64 Encoded JSON String
            if (body && typeof body === 'string') {
                try {
                    // console.log("Processing String Body:", body.substring(0, 20) + "...");
                    const decodedStr = Buffer.from(body, 'base64').toString('utf-8');
                    const bodyObj = JSON.parse(decodedStr);

                    if (bodyObj && 'encryptedKey' in bodyObj) {
                        encryptedKey = bodyObj.encryptedKey;
                        payload = bodyObj.payload;
                    }
                } catch (e) {
                    console.error("Failed to parse Body String:", e);
                    // Fallback or ignore
                }
            }
            // Fallback: Legacy Object check (in case some request wasn't transformed or local test)
            else if (body && typeof body === 'object' && 'encryptedKey' in body) {
                encryptedKey = (body as any).encryptedKey;
                payload = (body as any).payload;
            }
            // 2. Try Header (GET/DELETE)
            else if (headers['x-encrypted-key']) {
                encryptedKey = headers['x-encrypted-key'];
            }

            if (encryptedKey) {
                try {
                    // Decrypt AES Key
                    const aesKey = CryptoService.decryptAesKey(encryptedKey);

                    console.log(`[CryptoMiddleware] AES Key Decrypted Success for ${request.url}`);

                    // If there was a payload, decrypt it and return as body
                    // We must return 'body' to override the injected body
                    // AND return aesKey to put it in the context for onAfterHandle
                    if (payload) {
                        // Payload is now a string from the body
                        const data = CryptoService.decryptPayload(payload, aesKey);
                        console.log(`[CryptoMiddleware] Decrypted Data Keys for ${request.url}:`, Object.keys(data));
                        if (data.zipCode || data.zip_code) {
                            console.log(`[CryptoMiddleware] zipCode found: ${data.zipCode || data.zip_code}`);
                        }
                        return { body: data, aesKey };
                    }

                    // Just return the key if no payload (Header exchange)
                    return { aesKey };

                } catch (error) {
                    console.error(`[CryptoMiddleware] Decryption Failed for ${request.url}:`, error);

                    // If it's a GET/DELETE request (Header exchange), we can fallback to unencrypted response
                    // The client might be sending an old key (Server Restart)
                    if (request.method === 'GET' || request.method === 'DELETE') {
                        console.warn("[CryptoMiddleware] Ignoring invalid key for GET/DELETE, proceeding unencrypted.");
                        return { aesKey: null };
                    }

                    set.status = 400;
                    // Return the specific error message to the client for debugging
                    throw new Error(`Decryption failed: ${(error as any).message}`);
                }
            }

            // Explicitly return null if no key found, so aesKey exists in context as null
            return { aesKey: null };
        })
        .onAfterHandle(({ request, response, aesKey, set }) => {
            // Skip encryption for public key endpoint and static uploads
            if (request.url.includes('auth/public-key') || request.url.includes('/uploads/')) {
                return response;
            }

            // Encrypt response if we have an AES key from the request
            // AND response is a standard object (not a string/blob/etc unless intended)
            if (
                aesKey &&
                response &&
                typeof response === 'object' &&
                !(response instanceof Blob) &&
                !(response instanceof Response)
            ) {
                try {
                    console.log(`[CryptoMiddleware] Encrypting response for ${request.url}`);
                    const encryptedResponse = CryptoService.encryptResponse(response, aesKey as Buffer);
                    // Return the raw base64 string directly
                    return encryptedResponse;
                } catch (error) {
                    console.error("Encryption failed:", error);
                    set.status = 500;
                    return { message: "Encryption Error" };
                }
            }
            return response;
        })
        .get('/auth/public-key', () => {
            return { publicKey: CryptoService.getPublicKey() };
        });
