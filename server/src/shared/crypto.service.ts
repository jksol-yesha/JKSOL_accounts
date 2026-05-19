
import { generateKeyPairSync, privateDecrypt, publicEncrypt, randomBytes, createCipheriv, createDecipheriv, constants } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface EncryptedRequest {
    encryptedKey: string; // Base64 encoded RSA-encrypted AES key
    payload: string;      // Base64 encoded encrypted data (Single string, no IV/Tag object)
}


export class CryptoService {
    private static publicKey: string;
    private static privateKey: string;
    private static readonly DEFAULT_KEY_DIR = resolve(import.meta.dir, '../../.runtime/crypto');
    private static readonly PUBLIC_KEY_FILE = 'rsa-public.pem';
    private static readonly PRIVATE_KEY_FILE = 'rsa-private.pem';
    // Static IV (16 bytes) - Hardcoded as requested
    // Static IV (16 bytes) - Hardcoded as requested
    private static readonly STATIC_IV = Buffer.alloc(16, 0); // 16 bytes of zeros

    private static getKeyDirectory() {
        return String(process.env.CRYPTO_KEY_DIR || this.DEFAULT_KEY_DIR).trim();
    }

    private static loadKeysFromEnvironment() {
        const publicKey = String(process.env.CRYPTO_PUBLIC_KEY || '').replace(/\\n/g, '\n').trim();
        const privateKey = String(process.env.CRYPTO_PRIVATE_KEY || '').replace(/\\n/g, '\n').trim();

        if (!publicKey || !privateKey) return null;

        return { publicKey, privateKey };
    }

    private static loadKeysFromDisk() {
        const keyDir = this.getKeyDirectory();
        const publicKeyPath = resolve(keyDir, this.PUBLIC_KEY_FILE);
        const privateKeyPath = resolve(keyDir, this.PRIVATE_KEY_FILE);

        if (!existsSync(publicKeyPath) || !existsSync(privateKeyPath)) {
            return null;
        }

        try {
            return {
                publicKey: readFileSync(publicKeyPath, 'utf8'),
                privateKey: readFileSync(privateKeyPath, 'utf8')
            };
        } catch (error) {
            console.error('[CryptoService] Failed to read persisted RSA keys:', error);
            return null;
        }
    }

    private static persistKeysToDisk(publicKey: string, privateKey: string) {
        const keyDir = this.getKeyDirectory();
        const publicKeyPath = resolve(keyDir, this.PUBLIC_KEY_FILE);
        const privateKeyPath = resolve(keyDir, this.PRIVATE_KEY_FILE);

        try {
            mkdirSync(keyDir, { recursive: true });
            writeFileSync(publicKeyPath, publicKey, { encoding: 'utf8' });
            writeFileSync(privateKeyPath, privateKey, { encoding: 'utf8', mode: 0o600 });
        } catch (error) {
            console.error('[CryptoService] Failed to persist RSA keys:', error);
        }
    }

    // Initialize keys on startup
    static initialize() {
        if (this.publicKey && this.privateKey) return;

        const envKeys = this.loadKeysFromEnvironment();
        if (envKeys) {
            this.publicKey = envKeys.publicKey;
            this.privateKey = envKeys.privateKey;
            return;
        }

        const persistedKeys = this.loadKeysFromDisk();
        if (persistedKeys) {
            this.publicKey = persistedKeys.publicKey;
            this.privateKey = persistedKeys.privateKey;
            return;
        }

        const { publicKey, privateKey } = generateKeyPairSync('rsa', {
            modulusLength: 2048,
            publicKeyEncoding: {
                type: 'spki',
                format: 'pem'
            },
            privateKeyEncoding: {
                type: 'pkcs8',
                format: 'pem'
            }
        });

        this.publicKey = publicKey;
        this.privateKey = privateKey;
        this.persistKeysToDisk(publicKey, privateKey);
    }

    static getPublicKey(): string {
        if (!this.publicKey) this.initialize();
        return this.publicKey;
    }

    /**
     * Decrypts the AES Key from the encrypted RSA-AES key string.
     */
    static decryptAesKey(encryptedKey: string): Buffer {
        if (!this.privateKey) this.initialize();
        try {
            return privateDecrypt(
                {
                    key: this.privateKey,
                    padding: constants.RSA_PKCS1_OAEP_PADDING,
                    oaepHash: "sha256",
                },
                Buffer.from(encryptedKey, 'base64')
            );
        } catch (error) {
            console.error("AES Key Decryption Failed:", error);
            throw new Error("Invalid Encrypted Key");
        }
    }

    /**
     * Decrypts the payload using the provided AES Key and Static IV (Counter).
     * Payload is now just a base64 string.
     */
    static decryptPayload(encryptedData: string, aesKey: Buffer): any {
        try {
            // Check for legacy payload format (Frontend might be cached)
            if (typeof encryptedData !== 'string') {
                console.error("Payload Format Error: Expected string, got", typeof encryptedData);
                throw new Error("Invalid Payload Format: Expected Base64 String. Please clear browser cache.");
            }
            const cipherText = Buffer.from(encryptedData, 'base64');
            // AES-CTR (Counter Mode) - No padding required
            const decipher = createDecipheriv('aes-256-ctr', aesKey, this.STATIC_IV);

            let decrypted = decipher.update(cipherText);
            decrypted = Buffer.concat([decrypted, decipher.final()]);

            const decryptedStr = decrypted.toString('utf8');

            // Log success preview for debugging

            return JSON.parse(decryptedStr);
        } catch (error) {
            console.error("Payload Decryption Failed:", error);
            // Log details to help debug
            console.error("Payload Length:", encryptedData?.length);
            console.error("AES Key Length:", aesKey?.length);

            throw new Error("Invalid Payload: " + (error as any).message);
        }
    }

    /**
     * Helper wrapper for full request decryption (Legacy/Convenience)
     */
    static decryptRequest(body: EncryptedRequest): { data: any, aesKey: Buffer } {
        const aesKey = this.decryptAesKey(body.encryptedKey);
        const data = this.decryptPayload(body.payload, aesKey);
        return { data, aesKey };
    }

    /**
     * Encrypts the response body using the same AES key from the request.
     * Returns a base64 string directly.
     */
    static encryptResponse(data: any, aesKey: Buffer): string {
        const cipher = createCipheriv('aes-256-ctr', aesKey, this.STATIC_IV);

        const payloadStr = JSON.stringify(data);
        let encrypted = cipher.update(payloadStr, 'utf8');
        encrypted = Buffer.concat([encrypted, cipher.final()]);

        return encrypted.toString('base64');
    }
}
