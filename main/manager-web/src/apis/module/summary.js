import { apiRequest } from './family';

// The robot's daily summary ("দিনের সারাংশ"), built on the server every night.
export default {
    // [{day, talkCount, focusMinutes, pomodoros, gamesPlayed, highScores, remindersDone, remindersMissed,
    //   alarmsMissed, newMemories, mood, bondScore, bondLevel, textBn, textEn, final}] newest first
    getSummaries(deviceId, days, callback, failCallback) {
        apiRequest('GET', `/summary/device/${encodeURIComponent(deviceId)}?days=${days || 30}`, undefined, callback, failCallback);
    },
    buildToday(deviceId, callback, failCallback) {
        apiRequest('POST', `/summary/device/${encodeURIComponent(deviceId)}/build`, {}, callback, failCallback);
    },
};
