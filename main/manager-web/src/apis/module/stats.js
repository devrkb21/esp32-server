import { getServiceUrl } from '../api';
import RequestService from '../httpRequest';

export default {
    getSummary(callback) {
        RequestService.sendRequest()
            .url(`${getServiceUrl()}/stats/summary`)
            .method('GET')
            .success((res) => {
                RequestService.clearRequestTime();
                if (callback) callback(res);
            })
            .networkFail((err) => {
                console.error('Failed to get stats summary:', err);
                if (callback) callback({ code: 500, data: null });
            }).send();
    },

    getDailyUsage(callback) {
        RequestService.sendRequest()
            .url(`${getServiceUrl()}/stats/daily-usage`)
            .method('GET')
            .success((res) => {
                RequestService.clearRequestTime();
                if (callback) callback(res);
            })
            .networkFail((err) => {
                console.error('Failed to get daily usage stats:', err);
                if (callback) callback({ code: 500, data: null });
            }).send();
    }
};
