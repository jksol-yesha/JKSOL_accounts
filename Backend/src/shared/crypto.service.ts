
import { generateKeyPairSync, privateDecrypt, publicEncrypt, randomBytes, createCipheriv, createDecipheriv, constants } from 'node:crypto';

interface EncryptedRequest {
    encryptedKey: string; // Base64 encoded RSA-encrypted AES key
    payload: string;      // Base64 encoded encrypted data (Single string, no IV/Tag object)
}


export class CryptoService {
    private static publicKey: string;
    private static privateKey: string;
    // Static IV (16 bytes) - Hardcoded as requested
    // Static IV (16 bytes) - Hardcoded as requested
    private static readonly STATIC_IV = Buffer.alloc(16, 0); // 16 bytes of zeros

    // Initialize keys on startup
    static initialize() {
        if (this.publicKey && this.privateKey) return;

        console.log("Generating RSA Key Pair for Application Encryption...");
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
        console.log("RSA Key Pair Generated Successfully.");
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
            // console.log("Decrypting AES Key, length:", encryptedKey.length);
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

            // console.log("Decrypting Payload, length:", encryptedData.length);
            const cipherText = Buffer.from(encryptedData, 'base64');
            // AES-CTR (Counter Mode) - No padding required
            const decipher = createDecipheriv('aes-256-ctr', aesKey, this.STATIC_IV);

            let decrypted = decipher.update(cipherText);
            decrypted = Buffer.concat([decrypted, decipher.final()]);

            const decryptedStr = decrypted.toString('utf8');

            // Log success preview for debugging
            // console.log("Decrypted Preview:", decryptedStr.substring(0, 50));

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
