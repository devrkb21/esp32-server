import { getServiceUrl } from '../api';
import RequestService from '../httpRequest';

// Family sharing (manager-api module `family`): a robot's owner shares it with other accounts as
// member or co-owner; invitations are accepted or declined by the invited account.
export function apiRequest(method, path, data, callback, failCallback) {
    const request = RequestService.sendRequest().url(`${getServiceUrl()}${path}`).method(method);
    if (data !== undefined) request.data(data);
    request
        .success((res) => { RequestService.clearRequestTime(); if (callback) callback(res); })
        .fail((err) => { RequestService.clearRequestTime(); if (failCallback) failCallback(err); })
        .networkFail((err) => { if (failCallback) failCallback(err); })
        .send();
}

const enc = encodeURIComponent;

export default {
    // Robots shared WITH me: [{shareId, deviceId, agentId, agentName, alias, macAddress, board, ..., role, ownerName}]
    getSharedRobots(callback, failCallback) { apiRequest('GET', '/family/robots', undefined, callback, failCallback); },
    // {role, canShare, ownerName, members: [{id, userId, name, role, status, createdAt, respondedAt}]}
    getDeviceFamily(deviceId, callback, failCallback) { apiRequest('GET', `/family/device/${enc(deviceId)}`, undefined, callback, failCallback); },
    // target: username or phone; role: member | co_owner
    invite(deviceId, target, role, callback, failCallback) {
        apiRequest('POST', `/family/device/${enc(deviceId)}/invite`, { target, role }, callback, failCallback);
    },
    changeRole(shareId, role, callback, failCallback) { apiRequest('PUT', `/family/share/${enc(shareId)}`, { role }, callback, failCallback); },
    // Owner: remove someone or cancel an invite. Member / co-owner: leave.
    removeShare(shareId, callback, failCallback) { apiRequest('DELETE', `/family/share/${enc(shareId)}`, undefined, callback, failCallback); },
    // Pending invitations to me
    getInvites(callback, failCallback) { apiRequest('GET', '/family/invites', undefined, callback, failCallback); },
    acceptInvite(id, callback, failCallback) { apiRequest('POST', `/family/invites/${enc(id)}/accept`, {}, callback, failCallback); },
    declineInvite(id, callback, failCallback) { apiRequest('POST', `/family/invites/${enc(id)}/decline`, {}, callback, failCallback); },
};
