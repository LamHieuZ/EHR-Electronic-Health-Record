'use strict';

// Helper IPFS + AES-256-GCM encryption cho EHR
// Chien luoc:
//   1. encrypt plaintext -> ciphertext (IV || AuthTag || Cipher)
//   2. upload ciphertext len IPFS qua HTTP API /api/v0/add
//   3. pin lai de khong bi GC
//   4. tra ve { cid, plainHash, aesKeyHex, ivHex, authTagHex }
// Backend luu aesKey vao PDC qua chaincode, plainHash + cid tren public ledger.

const crypto = require('crypto');

const IPFS_API = process.env.IPFS_API_URL || 'http://localhost:5001';

function sha256(buf) {
    return crypto.createHash('sha256').update(buf).digest('hex');
}

// Encrypt buffer voi random AES-256 key
function encrypt(plaintext) {
    const aesKey = crypto.randomBytes(32);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return {
        ciphertext,
        aesKeyHex: aesKey.toString('hex'),
        ivHex: iv.toString('hex'),
        authTagHex: authTag.toString('hex')
    };
}

function decrypt(ciphertext, aesKeyHex, ivHex, authTagHex) {
    const aesKey = Buffer.from(aesKeyHex, 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

// Upload buffer len IPFS qua HTTP API
// Dung native fetch (Node 18+) + FormData
async function ipfsAdd(buffer, fileName) {
    const formData = new FormData();
    const blob = new Blob([buffer]);
    formData.append('file', blob, fileName || 'file');

    const res = await fetch(`${IPFS_API}/api/v0/add?pin=true&cid-version=1`, {
        method: 'POST',
        body: formData
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`IPFS add failed: ${res.status} ${text}`);
    }
    // Response la NDJSON, 1 dong cho 1 entry
    const text = await res.text();
    const lastLine = text.trim().split('\n').pop();
    const parsed = JSON.parse(lastLine);
    return parsed.Hash; // CID
}

async function ipfsCat(cid) {
    const res = await fetch(`${IPFS_API}/api/v0/cat?arg=${encodeURIComponent(cid)}`, {
        method: 'POST'
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`IPFS cat failed: ${res.status} ${text}`);
    }
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
}

async function ipfsVersion() {
    const res = await fetch(`${IPFS_API}/api/v0/version`, { method: 'POST' });
    if (!res.ok) throw new Error(`IPFS version failed: ${res.status}`);
    return res.json();
}

// Encrypt + upload + tra ve metadata can thiet
async function encryptAndUpload(plaintext, fileName) {
    const plainHash = sha256(plaintext);
    const { ciphertext, aesKeyHex, ivHex, authTagHex } = encrypt(plaintext);
    const cid = await ipfsAdd(ciphertext, fileName);
    return { cid, plainHash, aesKeyHex, ivHex, authTagHex, size: plaintext.length };
}

// Download + decrypt + verify integrity
async function downloadAndDecrypt(cid, aesKeyHex, ivHex, authTagHex, expectedPlainHash) {
    const ciphertext = await ipfsCat(cid);
    const plaintext = decrypt(ciphertext, aesKeyHex, ivHex, authTagHex);
    if (expectedPlainHash) {
        const actualHash = sha256(plaintext);
        if (actualHash !== expectedPlainHash) {
            throw new Error(`Integrity check failed: hash mismatch (got ${actualHash}, expected ${expectedPlainHash})`);
        }
    }
    return plaintext;
}

module.exports = {
    sha256,
    encrypt,
    decrypt,
    ipfsAdd,
    ipfsCat,
    ipfsVersion,
    encryptAndUpload,
    downloadAndDecrypt,
    IPFS_API
};
