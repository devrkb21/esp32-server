# Family sharing, notifications, care alerts and the daily summary

manager-api modules `family`, `notify` and `summary` (FAMILY wave). All endpoints sit under the
manager-api context path (`/xiaozhi`), need a logged-in user (`sys:role:normal`) and answer with
the usual `Result` wrapper. Ids of new rows are strings (snowflake ids do not fit a JavaScript
number).

## Roles and the one permission check

A robot (`ai_device`) has one owner (`user_id`). The owner can share it with other accounts as
`member` or `co_owner` (`ai_device_share`, accepted invites only).

| Action | owner | co_owner | member |
| --- | --- | --- | --- |
| VIEW: see the robot, its character, chat history, voiceprint list | yes | yes | yes |
| USE: Today, Day, Messages, Look (companion API), volume, restart | yes | yes | yes |
| MANAGE: rename, change the character, voiceprints, address book, bind robots to the character | yes | yes | no |
| DELETE: unbind the robot, delete the character | yes | no | no |
| SHARE: invite, change roles, remove people | yes | no | no |

Every ownership check goes through `family/service/DeviceAccessService` (static entry
`DeviceAccess` for the older classes): `CompanionController` (USE), `DeviceController`
(bind: MANAGE on the character, rename and address book: MANAGE, unbind: owner only and drops the
robot's shares), `DeviceServiceImpl` tools and gateway status (USE / VIEW), `AgentServiceImpl`
(read: VIEW, change: MANAGE, delete: DELETE), `AgentController` and `AgentChatHistoryController`
chat history (VIEW), `AgentVoicePrintController` (list: VIEW, add/change/delete: MANAGE).
A character's role is the strongest role the account has on a robot that runs it. A share made by
an earlier owner of a robot no longer counts.

## family

| Method | Path | Body / answer |
| --- | --- | --- |
| GET | `/family/robots` | robots shared with me: `[{shareId, deviceId, agentId, agentName, alias, macAddress, board, appVersion, productKey, productName, productNameBn, features, lastConnectedAtTimestamp, role, ownerName}]` |
| GET | `/family/device/{deviceId}` | `{role, canShare, ownerName, members:[{id, userId, name, self, role, status, createdAt, respondedAt}]}` (pending invites of others only for the owner) |
| POST | `/family/device/{deviceId}/invite` | `{target, role}`; target is a username or a phone number (Bangladeshi numbers match as `01XXXXXXXXX`, `8801XXXXXXXXX` and `+8801XXXXXXXXX`); answers the member row; at most 10 people per robot |
| PUT | `/family/share/{id}` | `{role}` (owner) |
| DELETE | `/family/share/{id}` | owner removes anyone or cancels an invite; a member or co-owner removes their own row (leave) |
| GET | `/family/invites` | pending invitations to me: `[{id, deviceId, robotName, productKey, productName, productNameBn, ownerName, role, createdAt}]` |
| POST | `/family/invites/{id}/accept`, `/decline` | |

An invite notifies the invitee (`family_invite`), an accepted invite notifies the owner
(`family_joined`).

## notify

Types and the groups people switch on and off:

| Type | Group | Made by |
| --- | --- | --- |
| `robot_offline` | offline | RobotWatchTask: the companion server has not heard from the robot and the MQTT gateway (when configured) does not see it, for longer than the person's `offlineMinutes` (10 to 720, default 30); once per offline spell |
| `alarm_missed` | alarm | robot event `alarm_missed`, or no `alarm_dismissed`/`alarm_snoozed` within 30 minutes of a timed alarm |
| `reminder_missed` | reminder | robot event `reminder_missed`, or no `reminder_done` within 30 minutes of a timed reminder |
| `care_fall` | care | robot event `fall` (the robot was dropped or knocked), when `care.fall_alert` |
| `care_medicine` | care | a missed medicine reminder (instead of `reminder_missed`), when `care.missed_medicine_alert` |
| `care_no_activity` | care | no touch (`stats.last_touch_s`) and no talk (chat history) for `care.no_activity_hours` between 08:00 and 21:00 |
| `daily_summary` | summary | DailySummaryTask at 21:00 |
| `family_invite`, `family_joined` | family | FamilyService |
| `test` | (always) | `POST /notify/push/test` |

Alerts about a robot go to its owner and every accepted family member. Copy says care alert
(যত্নের সতর্কতা), never medical monitoring. All clock rules use Asia/Dhaka.

| Method | Path | Body / answer |
| --- | --- | --- |
| GET | `/notify/list?page=1&limit=20&unread=0\|1` | `{total, unread, list:[{id, type, group, titleBn, titleEn, bodyBn, bodyEn, deviceId, robotName, createdAt, read}]}` newest first; a user keeps the last 300 |
| GET | `/notify/unread-count` | `{unread}` |
| POST | `/notify/{id}/read`, `/notify/read-all` | |
| GET, PUT | `/notify/prefs` | `{types:{offline, alarm, reminder, care, summary, family}, offlineMinutes, summaryPush, webPush:{publicKey, subscriptions}}`; PUT takes any part of it. `summaryPush: false` keeps the summary in the list without a push |
| GET | `/notify/push/vapid` | `{publicKey}` (base64url, 65-byte P-256 point) |
| POST | `/notify/push/subscribe` | `{endpoint, keys:{p256dh, auth}, platform:'web'\|'h5'}` |
| POST | `/notify/push/unsubscribe` | `{endpoint}` |
| POST | `/notify/push/native` | `{provider:'unipush'\|'fcm', token}` (stored only, see below) |
| POST | `/notify/push/test` | sends me a test notification |

### Web push

`notify/push/PushService` with `WebPushCrypto` (JDK only): VAPID (RFC 8292, ES256 JWT) and
`aes128gcm` payload encryption (RFC 8291). At the first start manager-api generates the key pair
and stores it as sys params `push.vapid_public_key` and `push.vapid_private_key`, both
`param_type 0` (hidden from the params page and from the xiaozhi-server config); the private key
never leaves the server. `push.vapid_subject` (visible param) is the sender contact the push
services see; set it to a `mailto:` of the operator. The server only posts to the browsers' push
services (Google, Mozilla, Microsoft, Apple hosts); gone subscriptions (404/410) and ones failing
five times are dropped. Browsers only allow push on https pages (or localhost).

Payload the service worker receives: `{id, type, title, body, titleBn, titleEn, bodyBn, bodyEn,
deviceId, url}` (`url` is `/summary` for the daily summary, else `/notifications`).

### Native push (not configured yet)

The interface is `notify/push/NativePushSender`; the default bean `NoopNativePushSender` sends
nothing. To turn it on: call `POST /notify/push/native` from the app after login with the uni-push
client id or FCM token (manager-mobile `utils/nativePush.ts`, off by default), and add a
`@Primary` bean implementing `NativePushSender` that sends the payload above through uni-push 2
or the FCM HTTP v1 API (credentials as hidden sys params) and returns false for dead tokens.

## Care alerts (companion setting)

`settings.care` of the companion API gains three keys next to the robot's own `enabled` and
`lonely_after_min` (xiaozhi-server `core/companion/schema.py`):

```json
{"enabled": true, "lonely_after_min": 180, "no_activity_hours": 0, "fall_alert": true, "missed_medicine_alert": true}
```

`no_activity_hours` 0 to 12 (0 = off). Alerts only run while `enabled` is on. The robot event
`fall` is accepted by the companion report like every other event.

## summary

`GET /summary/device/{deviceId}?days=30` answers the last days that have a summary, newest first:
`[{day, talkCount, focusMinutes, pomodoros, gamesPlayed, highScores, remindersDone,
remindersMissed, alarmsMissed, newMemories, mood, bondScore, bondLevel, textBn, textEn, final}]`.
`POST /summary/device/{deviceId}/build` builds today's row now. The nightly job builds every
robot's day at 21:00 (and sends it as `daily_summary`) and again at 23:55 (`final`). Numbers come
from the robot's events of the day (companion API, last 200), its stats (mood and bond only for
the day itself), chat history (talks) and memories created that day; focus minutes are finished
pomodoro rounds times the work length.

## Tables (changelog 202611010300)

`ai_device_share`, `ai_notification`, `ai_push_subscription`, `ai_notify_pref`,
`ai_daily_summary`; sys param `push.vapid_subject`; product features `family` (TinyBot and the
generic product), `care` and `summary` (TinyBot).
