import { getServiceUrl } from '../api';
import RequestService from '../httpRequest';

// TinyBot companion (alarms, reminders, focus timer, prayer times, night mode, phone messages
// and commands). manager-api forwards these to xiaozhi-server's companion API after checking
// that the device belongs to the logged-in user; see docs/companion-api.md.

function companionRequest(method, path, data, callback, failCallback) {
    const request = RequestService.sendRequest()
        .url(`${getServiceUrl()}/device/companion${path}`)
        .method(method);
    if (data !== undefined) {
        request.data(data);
    }
    request
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
            console.error(`Companion ${method} ${path} failed:`, err);
            if (failCallback) {
                failCallback(err);
            }
        }).send();
}

function devicePath(deviceId, suffix = '') {
    return `/${encodeURIComponent(deviceId)}${suffix}`;
}

export default {
    // Full companion view: name, online, last_seen, stats, settings, pomodoro, alarms, reminders,
    // prayer, weather, events, messages, commands, rev. Polled: no automatic retry.
    getCompanion(deviceId, callback, failCallback) {
        companionRequest('GET', devicePath(deviceId), undefined, callback, failCallback);
    },
    // Partial update: name, settings, pomodoro, alarms (whole list), reminders (whole list),
    // prayer {enabled, remind, city, lat, lon}, weather {city, lat, lon}. Returns the full view.
    updateCompanionConfig(deviceId, patch, callback, failCallback) {
        companionRequest('PUT', devicePath(deviceId, '/config'), patch, callback, failCallback);
    },
    getCompanionMessages(deviceId, callback, failCallback) {
        companionRequest('GET', devicePath(deviceId, '/messages'), undefined, callback, failCallback);
    },
    // message: {from, text, ask}
    sendCompanionMessage(deviceId, message, callback, failCallback) {
        companionRequest('POST', devicePath(deviceId, '/messages'), {
            from: message.from || '',
            text: message.text,
            ask: !!message.ask,
        }, callback, failCallback);
    },
    // type: story, pomodoro, lullaby, ring, breathe, night_light, game
    sendCompanionCommand(deviceId, type, arg, callback, failCallback) {
        companionRequest('POST', devicePath(deviceId, '/commands'), {
            type,
            arg: arg === undefined || arg === null ? '' : String(arg),
        }, callback, failCallback);
    },
    getCompanionEvents(deviceId, limit, callback, failCallback) {
        const query = new URLSearchParams({ limit: limit || 50 }).toString();
        companionRequest('GET', devicePath(deviceId, `/events?${query}`), undefined, callback, failCallback);
    },
    // City search for prayer times and weather: data = {results: [{name, country, admin1, lat, lon, timezone}]}
    geocodeCity(query, callback, failCallback) {
        const params = new URLSearchParams({ q: query }).toString();
        companionRequest('GET', `/geocode?${params}`, undefined, callback, failCallback);
    },
};
