import { getServiceUrl } from '../api';
import RequestService from '../httpRequest';

export default {
    // Bound devices
    getAgentBindDevices(agentId, callback, failCallback) {
        RequestService.sendRequest()
            .url(`${getServiceUrl()}/device/bind/${agentId}`)
            .method('GET')
            .success((res) => {
                RequestService.clearRequestTime();
                callback(res);
            })
            .fail((err) => {
                RequestService.clearRequestTime();
                if (failCallback) {
                    failCallback(err);
                }
            })
            .networkFail((err) => {
                console.error('Failed to get device list:', err);
                RequestService.reAjaxFun(() => {
                    this.getAgentBindDevices(agentId, callback, failCallback);
                });
            }).send();
    },
    // Unbind device
    unbindDevice(device_id, callback, failCallback) {
        RequestService.sendRequest()
            .url(`${getServiceUrl()}/device/unbind`)
            .method('POST')
            .data({ deviceId: device_id })
            .success((res) => {
                RequestService.clearRequestTime();
                callback(res);
            })
            .fail((err) => {
                RequestService.clearRequestTime();
                if (failCallback) {
                    failCallback(err);
                }
            })
            .networkFail((err) => {
                console.error('Failed to unbind device:', err);
                RequestService.reAjaxFun(() => {
                    this.unbindDevice(device_id, callback, failCallback);
                });
            }).send();
    },
    // Bind device
    bindDevice(agentId, deviceCode, callback, failCallback) {
        RequestService.sendRequest()
            .url(`${getServiceUrl()}/device/bind/${agentId}/${deviceCode}`)
            .method('POST')
            .success((res) => {
                RequestService.clearRequestTime();
                callback(res);
            })
            .fail((err) => {
                RequestService.clearRequestTime();
                if (failCallback) {
                    failCallback(err);
                }
            })
            .networkFail((err) => {
                console.error('Failed to bind device:', err);
                RequestService.reAjaxFun(() => {
                    this.bindDevice(agentId, deviceCode, callback, failCallback);
                });
            }).send();
    },
    updateDeviceInfo(id, payload, callback, failCallback) {
        RequestService.sendRequest()
            .url(`${getServiceUrl()}/device/update/${id}`)
            .method('PUT')
            .data(payload)
            .success((res) => {
                RequestService.clearRequestTime()
                callback(res)
            })
            .fail((err) => {
                RequestService.clearRequestTime();
                if (failCallback) {
                    failCallback(err);
                }
            })
            .networkFail((err) => {
                console.error('Failed to update OTA status:', err)
                this.$message.error(err.msg || 'Failed to update OTA status')
                RequestService.reAjaxFun(() => {
                    this.updateDeviceInfo(id, payload, callback, failCallback)
                })
            }).send()
    },
    // Manually add device
    manualAddDevice(params, callback, failCallback) {
        RequestService.sendRequest()
            .url(`${getServiceUrl()}/device/manual-add`)
            .method('POST')
            .data(params)
            .success((res) => {
                RequestService.clearRequestTime();
                callback(res);
            })
            .fail((err) => {
                RequestService.clearRequestTime();
                if (failCallback) {
                    failCallback(err);
                }
            })
            .networkFail((err) => {
                console.error('Failed to manually add device:', err);
                RequestService.reAjaxFun(() => {
                    this.manualAddDevice(params, callback, failCallback);
                });
            }).send();
    },
    // Get device status
    getDeviceStatus(agentId, callback, failCallback) {
        RequestService.sendRequest()
            .url(`${getServiceUrl()}/device/bind/${agentId}`)
            .method('POST')
            .data({}) // Send empty object as request body
            .success((res) => {
                RequestService.clearRequestTime();
                callback(res);
            })
            .fail((err) => {
                RequestService.clearRequestTime();
                if (failCallback) {
                    failCallback(err);
                }
            })
            .networkFail((err) => {
                console.error('Failed to get device status:', err);
                RequestService.reAjaxFun(() => {
                    this.getDeviceStatus(agentId, callback, failCallback);
                });
            }).send();
    },
    // Call device tool
    callDeviceTool(deviceId, name, args, callback) {
        RequestService.sendRequest()
            .url(`${getServiceUrl()}/device/tools/call/${deviceId}`)
            .method('POST')
            .data({ name, arguments: args || {} })
            .success((res) => {
                RequestService.clearRequestTime();
                callback(res);
            })
            .fail((res) => {
                callback(res);
            })
            .networkFail((err) => {
                console.error('Failed to call device tool:', err);
                RequestService.reAjaxFun(() => {
                    this.callDeviceTool(deviceId, name, args, callback);
                });
            }).send();
    },
    // Call a device tool once, as a promise. Unlike callDeviceTool it never retries on a
    // network error (a retried self.reboot would reboot the robot twice). Resolves with the
    // response body {code, msg, data}; rejects with {msg} when the robot does not answer.
    callDeviceToolOnce(deviceId, name, args) {
        return new Promise((resolve, reject) => {
            RequestService.sendRequest()
                .url(`${getServiceUrl()}/device/tools/call/${deviceId}`)
                .method('POST')
                .data({ name, arguments: args || {} })
                .success((res) => {
                    RequestService.clearRequestTime();
                    resolve(res.data);
                })
                .fail((res) => {
                    reject((res && res.data) || { msg: '' });
                })
                .networkFail((err) => {
                    reject({ msg: (err && err.message) || '', network: true });
                }).send();
        });
    },
    // Reboot device
    rebootDevice(deviceId, callback) {
        RequestService.sendRequest()
            .url(`${getServiceUrl()}/device/command/${deviceId}/reboot`)
            .method('POST')
            .data({})
            .success((res) => {
                RequestService.clearRequestTime();
                callback(res);
            })
            .fail((res) => {
                callback(res);
            })
            .networkFail((err) => {
                console.error('Failed to reboot device:', err);
                RequestService.reAjaxFun(() => {
                    this.rebootDevice(deviceId, callback);
                });
            }).send();
    },
    // Set device volume
    setDeviceVolume(deviceId, volume, callback) {
        RequestService.sendRequest()
            .url(`${getServiceUrl()}/device/command/${deviceId}/volume`)
            .method('POST')
            .data({ volume })
            .success((res) => {
                RequestService.clearRequestTime();
                callback(res);
            })
            .fail((res) => {
                callback(res);
            })
            .networkFail((err) => {
                console.error('Failed to set device volume:', err);
                RequestService.reAjaxFun(() => {
                    this.setDeviceVolume(deviceId, volume, callback);
                });
            }).send();
    },
}
