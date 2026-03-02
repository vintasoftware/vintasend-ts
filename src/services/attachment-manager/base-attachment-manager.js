import * as crypto from 'node:crypto';
import * as mime from 'mime-types';
export class BaseAttachmentManager {
    /**
     * Detect content type from filename
     * Public to allow backends and custom implementations to use it
     */
    detectContentType(filename) {
        return mime.lookup(filename) || 'application/octet-stream';
    }
    /**
     * Calculate checksum for file data
     * Public to allow backends to perform deduplication checks
     */
    calculateChecksum(data) {
        return crypto.createHash('sha256').update(data).digest('hex');
    }
    /**
     * Convert various file formats to Buffer
     * Public to allow backends and custom implementations to use it
     */
    async fileToBuffer(file) {
        if (Buffer.isBuffer(file)) {
            return file;
        }
        // Support both Web ReadableStream and Node.js Readable streams
        if (typeof ReadableStream !== 'undefined' && file instanceof ReadableStream) {
            return this.webStreamToBuffer(file);
        }
        // Check for Node.js Readable stream
        if (this.isNodeReadable(file)) {
            return this.nodeStreamToBuffer(file);
        }
        if (typeof file === 'string') {
            const fs = await import('node:fs/promises');
            return fs.readFile(file);
        }
        throw new Error('Unsupported file type');
    }
    /**
     * Type guard to check if value is a Node.js Readable stream
     */
    isNodeReadable(value) {
        return (typeof value === 'object' &&
            value !== null &&
            typeof value.read === 'function' &&
            typeof value.on === 'function' &&
            typeof value.pipe === 'function');
    }
    /**
     * Convert Web ReadableStream to Buffer
     */
    async webStreamToBuffer(stream) {
        const reader = stream.getReader();
        const chunks = [];
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            chunks.push(value);
        }
        return Buffer.concat(chunks);
    }
    /**
     * Convert Node.js Readable stream to Buffer
     */
    async nodeStreamToBuffer(stream) {
        const chunks = [];
        return new Promise((resolve, reject) => {
            stream.on('data', (chunk) => chunks.push(chunk));
            stream.on('error', reject);
            stream.on('end', () => resolve(Buffer.concat(chunks)));
        });
    }
}
