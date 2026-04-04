// Web Crypto API implementation for Hybrid Encryption - AES-CBC + Static IV
let cachedPublicKey = null;
let fetchPromise = null;

// Static IV (16 bytes of zeros)
const STATIC_IV = new Uint8Array(16);

// Convert ArrayBuffer to Base64
function ab2str(buf) {
    return btoa(String.fromCharCode.apply(null, new Uint8Array(buf)));
}

// Convert Base64 to ArrayBuffer
function str2ab_b64(base64) {
    const binary_string = window.atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
}

export const clearPublicKey = () => {
    cachedPublicKey = null;
};

// Fetch and Import Public Key
export const fetchPublicKey = async (baseUrl) => {
    if (cachedPublicKey) return cachedPublicKey;
    if (fetchPromise) return fetchPromise;

    fetchPromise = (async () => {
        try {
            const response = await fetch(`${baseUrl}/auth/public-key`, { cache: 'no-store' });
            if (!response.ok) {
                console.error(`Fetch Public Key Failed: ${response.status} ${response.statusText}`);
                fetchPromise = null;
                return null;
            }

            const data = await response.json();
            const pem = data.publicKey;
            if (!pem) {
                fetchPromise = null;
                return null;
            }

            const pemHeader = "-----BEGIN PUBLIC KEY-----";
            const pemFooter = "-----END PUBLIC KEY-----";
            const pemContents = pem.substring(
                pem.indexOf(pemHeader) + pemHeader.length,
                pem.indexOf(pemFooter)
            ).replace(/\n/g, "");

            const binaryDer = str2ab_b64(pemContents);

            cachedPublicKey = await window.crypto.subtle.importKey(
                "spki",
                binaryDer,
                {
                    name: "RSA-OAEP",
                    hash: "SHA-256"
                },
                true,
                ["encrypt"]
            );
            return cachedPublicKey;
        } catch (error) {
            console.error("Failed to load Public Key:", error);
            fetchPromise = null;
            return null;
        } finally {
            fetchPromise = null;
        }
    })();

    return fetchPromise;
};

// Encrypt Payload using AES-CTR with Static IV (Counter)
export const encryptPayload = async (data) => {
    if (!cachedPublicKey) {
        console.warn("Public key not loaded, cannot encrypt.");
        return null;
    }

    try {
        // 1. Generate AES Key (AES-CTR)
        const aesKey = await window.crypto.subtle.generateKey(
            {
                name: "AES-CTR",
                length: 256
            },
            true,
            ["encrypt", "decrypt"]
        );

        // 2. Encrypt Data with AES-CTR
        // No padding required for CTR mode
        const rawData = new TextEncoder().encode(JSON.stringify(data));

        const encryptedContent = await window.crypto.subtle.encrypt(
            {
                name: "AES-CTR",
                counter: STATIC_IV,
                length: 64 // Counter length in bits (standard is 64 for 128-bit block)
            },
            aesKey,
            rawData
        );

        // 3. Encrypt AES Key with RSA
        const rawAesKey = await window.crypto.subtle.exportKey("raw", aesKey);
        const encryptedAesKey = await window.crypto.subtle.encrypt(
            {
                name: "RSA-OAEP"
            },
            cachedPublicKey,
            rawAesKey
        );

        // 4. Return simplified structure
        return {
            encryptedKey: ab2str(encryptedAesKey),
            payload: ab2str(encryptedContent), // just the base64 string
            aesKey: aesKey
        };

    } catch (error) {
        console.error("Encryption Failed:", error);
        throw error;
    }
};

// Generate Encrypted AES Key (for Header-based exchange)
export const generateEncryptedKey = async () => {
    if (!cachedPublicKey) {
        console.warn("Public key not loaded, cannot generate key.");
        return null;
    }
    try {
        const aesKey = await window.crypto.subtle.generateKey(
            { name: "AES-CTR", length: 256 },
            true,
            ["encrypt", "decrypt"]
        );

        const rawAesKey = await window.crypto.subtle.exportKey("raw", aesKey);
        const encryptedAesKey = await window.crypto.subtle.encrypt(
            { name: "RSA-OAEP" },
            cachedPublicKey,
            rawAesKey
        );

        return {
            encryptedKey: ab2str(encryptedAesKey),
            aesKey: aesKey
        };
    } catch (error) {
        console.error("Key Generation Failed:", error);
        return null;
    }
};

// Decrypt Response using AES-CTR with Static IV (Counter)
export const decryptResponse = async (encryptedResponse, aesKey) => {
    try {
        // encryptedResponse should be a base64 string now
        if (typeof encryptedResponse !== 'string') {
            // Fallback for unexpected format or unencrypted 400s
            if (encryptedResponse && encryptedResponse.iv) {
                console.warn("Received object update instead of string. Backend might be sending error object directly?");
                return encryptedResponse;
            }
            return encryptedResponse;
        }

        const dataBuf = str2ab_b64(encryptedResponse);

        const decrypted = await window.crypto.subtle.decrypt(
            {
                name: "AES-CTR",
                counter: STATIC_IV,
                length: 64
            },
            aesKey,
            dataBuf
        );

        // No Unpadding required for CTR
        const decoded = new TextDecoder().decode(decrypted);
        return JSON.parse(decoded);

    } catch (error) {
        console.error("Decryption Failed:", error);
        // Fallback: maybe it wasn't encrypted?
        return encryptedResponse;
    }
};
