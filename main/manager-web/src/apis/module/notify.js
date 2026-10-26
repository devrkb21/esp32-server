import { apiRequest } from './family';

// Notification center and web push (manager-api module `notify`).
export default {
    // {total, unread, list: [{id, type, group, titleBn, titleEn, bodyBn, bodyEn, deviceId, robotName, createdAt, read}]}
    getList({ page = 1, limit = 20, unread = false } = {}, callback, failCallback) {
        const q = new URLSearchParams({ page, limit, unread: unread ? 1 : 0 }).toString();
        apiRequest('GET', `/notify/list?${q}`, undefined, callback, failCallback);
    },
    getUnreadCount(callback, failCallback) { apiRequest('GET', '/notify/unread-count', undefined, callback, failCallback); },
    markRead(id, callback, failCallback) { apiRequest('POST', `/notify/${encodeURIComponent(id)}/read`, {}, callback, failCallback); },
    markAllRead(callback, failCallback) { apiRequest('POST', '/notify/read-all', {}, callback, failCallback); },
    // {types: {offline, alarm, reminder, care, summary, family}, offlineMinutes, summaryPush, webPush: {publicKey, subscriptions}}
    getPrefs(callback, failCallback) { apiRequest('GET', '/notify/prefs', undefined, callback, failCallback); },
    savePrefs(prefs, callback, failCallback) { apiRequest('PUT', '/notify/prefs', prefs, callback, failCallback); },
    getVapidKey(callback, failCallback) { apiRequest('GET', '/notify/push/vapid', undefined, callback, failCallback); },
    // sub: {endpoint, keys: {p256dh, auth}, platform: 'web'}
    subscribe(sub, callback, failCallback) { apiRequest('POST', '/notify/push/subscribe', sub, callback, failCallback); },
    unsubscribe(endpoint, callback, failCallback) { apiRequest('POST', '/notify/push/unsubscribe', { endpoint }, callback, failCallback); },
    sendTest(callback, failCallback) { apiRequest('POST', '/notify/push/test', {}, callback, failCallback); },
};
