export const DEFAULT_BACKEND_FILTER_CAPABILITIES = {
    'logical.and': true,
    'logical.or': true,
    'logical.not': true,
    'logical.notNested': true,
    'fields.status': true,
    'fields.notificationType': true,
    'fields.adapterUsed': true,
    'fields.userId': true,
    'fields.bodyTemplate': true,
    'fields.subjectTemplate': true,
    'fields.contextName': true,
    'fields.sendAfterRange': true,
    'fields.createdAtRange': true,
    'fields.sentAtRange': true,
    'negation.sendAfterRange': true,
    'negation.createdAtRange': true,
    'negation.sentAtRange': true,
    'stringLookups.startsWith': true,
    'stringLookups.endsWith': true,
    'stringLookups.includes': true,
    'stringLookups.caseInsensitive': true,
    'orderBy.sendAfter': true,
    'orderBy.sentAt': true,
    'orderBy.readAt': true,
    'orderBy.createdAt': true,
    'orderBy.updatedAt': true,
};
/**
 * Type guard to check if a filter is a field filter (leaf node).
 */
export function isFieldFilter(filter) {
    return !('and' in filter) && !('or' in filter) && !('not' in filter);
}
export function isStringFilterLookup(value) {
    return typeof value === 'object' && value !== null && 'lookup' in value && 'value' in value;
}
/**
 * Type guard to check if backend supports attachment operations
 */
export function supportsAttachments(backend) {
    return (typeof backend.storeAttachmentFileRecord === 'function' &&
        typeof backend.getAttachmentFileRecord === 'function' &&
        typeof backend.findAttachmentFileByChecksum === 'function' &&
        typeof backend.deleteAttachmentFile === 'function' &&
        typeof backend.getOrphanedAttachmentFiles === 'function' &&
        typeof backend.getAttachments === 'function' &&
        typeof backend.deleteNotificationAttachment === 'function');
}
