// Type guard to check if attachment is a reference
export function isAttachmentReference(attachment) {
    return 'fileId' in attachment;
}
