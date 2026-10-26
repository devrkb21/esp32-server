import { getServiceUrl } from '../api';
import RequestService from '../httpRequest';

// TinyBot's special days (admin): the dated list of Eid ul-Fitr, Eid ul-Adha and custom days the
// robots greet for. The fixed national days are known to the server; Eid dates are only what an
// admin enters here. Days: [{ id, date: 'YYYY-MM-DD', key, nameBn, nameEn }].
function calendarRequest(method, data, callback, failCallback) {
    RequestService.sendRequest()
        .url(`${getServiceUrl()}/calendar/days`)
        .method(method)
        .data(data)
        .success((res) => {
            RequestService.clearRequestTime();
            callback(res);
        })
        .fail((err) => {
            RequestService.clearRequestTime();
            if (failCallback) failCallback(err);
        })
        .networkFail((err) => {
            console.error(`Calendar ${method} failed:`, err);
            if (failCallback) failCallback(err);
        }).send();
}

export default {
    getCalendarDays(callback, failCallback) {
        calendarRequest('GET', undefined, callback, failCallback);
    },
    // Create (no id) or update (with id) one day
    saveCalendarDay(day, callback, failCallback) {
        calendarRequest(day.id ? 'PUT' : 'POST', day, callback, failCallback);
    },
    deleteCalendarDays(ids, callback, failCallback) {
        calendarRequest('DELETE', ids, callback, failCallback);
    },
};
