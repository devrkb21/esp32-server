import { getServiceUrl } from '../api';
import RequestService from '../httpRequest';

// Smart home (manager-api module `home`) and robot contacts (module `contacts`), promise style.
// Secrets (Home Assistant token, MQTT password) are only ever sent; the server answers with
// tokenSaved / passwordSaved and never sends a secret back.

function call(method, path, data) {
  return new Promise((resolve, reject) => {
    const req = RequestService.sendRequest().url(`${getServiceUrl()}${path}`).method(method);
    if (data !== undefined) req.data(data);
    req.success((res) => { RequestService.clearRequestTime(); resolve(res && res.data ? res.data.data : null); })
      .fail((err) => { RequestService.clearRequestTime(); reject(err || {}); })
      .networkFail((err) => reject(err || { network: true }))
      .send();
  });
}

const id = (v) => encodeURIComponent(String(v));

export default {
  // {ha: {baseUrl, tokenSaved}, mqtt: {host, port, username, passwordSaved, tls}, deviceCount}
  getIntegration: () => call('GET', '/home/integration'),
  // {haBaseUrl, haToken?, clearHaToken?, mqttHost, mqttPort, mqttUsername, mqttPassword?, clearMqttPassword?, mqttTls}
  saveIntegration: (body) => call('PUT', '/home/integration', body),
  // target ha | mqtt -> {ok, code, message, version?}
  testIntegration: (target) => call('POST', `/home/integration/test?target=${id(target)}`, {}),
  // -> {ok, code, found, added, devices}
  importHa: () => call('POST', '/home/ha/import', {}),
  // -> [{id, source, entityId, domain, name, aliases, topic, payloadOn, payloadOff, enabled}]
  listDevices: () => call('GET', '/home/devices'),
  addDevice: (body) => call('POST', '/home/devices', body),
  updateDevice: (deviceId, body) => call('PUT', `/home/devices/${id(deviceId)}`, body),
  deleteDevice: (deviceId) => call('DELETE', `/home/devices/${id(deviceId)}`),
  // {action: on|off|open|close|..., value?} -> {ok, code, message, device, action}
  act: (deviceId, action, value) => call('POST', `/home/devices/${id(deviceId)}/action`, value == null ? { action } : { action, value }),

  // Robot contacts: {robots: [{deviceId, name}], contacts: [{id, status, direction, myDeviceId, ...}]}
  getContacts: () => call('GET', '/contacts'),
  requestContact: (body) => call('POST', '/contacts', body),
  acceptContact: (contactId, body) => call('POST', `/contacts/${id(contactId)}/accept`, body),
  declineContact: (contactId) => call('POST', `/contacts/${id(contactId)}/decline`, {}),
  renameContact: (contactId, body) => call('PUT', `/contacts/${id(contactId)}`, body),
  removeContact: (contactId) => call('DELETE', `/contacts/${id(contactId)}`),
  // -> [{key, name, aliases, kind}]
  contactTargets: (deviceId) => call('GET', `/contacts/targets?deviceId=${id(deviceId)}`),
  // {fromDeviceId, target, text} -> {ok, code, to, later}
  sendToRobot: (body) => call('POST', '/contacts/send', body),
};
