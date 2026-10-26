import { getServiceUrl } from '../api';
import RequestService from '../httpRequest';

// AI wave: usage and cost (back office), the owner's daily quota, and kids mode of a character.
// Callback style like the other modules: callback({ data: { code, data } }), failCallback(err).
function send(method, path, data, callback, failCallback, label) {
    const req = RequestService.sendRequest()
        .url(`${getServiceUrl()}${path}`)
        .method(method);
    if (data !== undefined) req.data(data);
    req.success((res) => {
        RequestService.clearRequestTime();
        callback(res);
    })
        .fail((err) => {
            RequestService.clearRequestTime();
            if (failCallback) failCallback(err);
        })
        .networkFail((err) => {
            console.error(`Failed to ${label}:`, err);
            if (failCallback) failCallback(err);
        }).send();
}

export default {
    // Super admin: { from, to, today, currency, dailyLimit, priced, totals, days[], models[], users[], robots[] }
    getUsageSummary(params, callback, failCallback) {
        const q = new URLSearchParams();
        if (params && params.from) q.set('from', params.from);
        if (params && params.to) q.set('to', params.to);
        const qs = q.toString();
        send('GET', `/usage/summary${qs ? `?${qs}` : ''}`, undefined, callback, failCallback, 'get usage summary');
    },
    // The signed-in owner: { date, limit, used, remaining, exceeded, blocked }
    getQuota(callback, failCallback) {
        send('GET', '/usage/quota', undefined, callback, failCallback, 'get quota');
    },
    // Kids mode of a character: { enabled, age, blockedTopics }
    getKids(agentId, callback, failCallback) {
        send('GET', `/agent/${encodeURIComponent(agentId)}/kids`, undefined, callback, failCallback, 'get kids mode');
    },
    saveKids(agentId, data, callback, failCallback) {
        send('PUT', `/agent/${encodeURIComponent(agentId)}/kids`, data, callback, failCallback, 'save kids mode');
    },
};
