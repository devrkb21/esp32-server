<template>
  <div class="welcome">
    <HeaderBar />

    <div class="main-wrapper">
      <div class="content-panel">
        <div class="content-area">
          <el-card class="companion-card" shadow="never">
            <div class="operation-header">
              <div class="title-block">
                <el-button icon="el-icon-arrow-left" size="small" class="back-btn" @click="goBack">
                  {{ $t('companion.back') }}
                </el-button>
                <h2 class="page-title">
                  {{ $t('companion.title') }}<span v-if="dev && dev.name"> · {{ dev.name }}</span>
                </h2>
                <template v-if="dev">
                  <el-tag v-if="dev.online" type="success" effect="dark" size="mini">
                    <i class="el-icon-circle-check"></i> {{ $t('companion.online') }}
                  </el-tag>
                  <el-tag v-else type="info" effect="plain" size="mini">
                    <i class="el-icon-circle-close"></i> {{ $t('companion.offline') }}
                  </el-tag>
                  <span class="muted small">{{ $t('companion.lastSeen') }}: {{ ago(dev.last_seen) }}</span>
                </template>
              </div>
              <el-button icon="el-icon-refresh" size="small" :loading="loading" @click="refresh(false)">
                {{ $t('companion.refresh') }}
              </el-button>
            </div>

            <el-alert v-if="!deviceId" type="error" :title="$t('companion.noDevice')" :closable="false" show-icon />
            <el-alert v-else-if="loadError" type="error" :title="loadError" :closable="false" show-icon class="load-error" />

            <div v-if="!dev && deviceId && !loadError" class="placeholder" v-loading="true"
              :element-loading-text="$t('companion.loading')"></div>

            <el-tabs v-if="dev" v-model="activeTab" class="companion-tabs">
              <!-- Status -->
              <el-tab-pane :label="$t('companion.tab.status')" name="status">
                <div class="grid">
                  <div class="panel">
                    <h3>{{ $t('companion.status.robot') }}</h3>
                    <div class="mood">
                      <span class="mood-emoji">{{ moodEmoji(stats.mood) }}</span>
                      <div>
                        <div class="big">{{ stats.mood || '-' }}</div>
                        <div class="muted small">{{ $t('companion.status.state') }}: {{ stats.state || '-' }}</div>
                      </div>
                    </div>
                    <div v-if="stats.bond_score !== undefined" class="bond">
                      <div class="row spread small">
                        <span>{{ $t('companion.status.bondLevel', { level: stats.bond_level || 0 }) }}</span>
                        <span>{{ stats.bond_score }}/100</span>
                      </div>
                      <el-progress :percentage="clampPercent(stats.bond_score)" :show-text="false" :stroke-width="8" />
                    </div>
                    <div class="stat-row">
                      <div class="stat"><b>{{ stats.streak || 0 }}</b><span>{{ $t('companion.status.streak') }}</span></div>
                      <div class="stat"><b>{{ stats.pomodoros_today || 0 }}</b><span>{{ $t('companion.status.pomodorosToday') }}</span></div>
                      <div class="stat"><b>{{ stats.volume !== undefined ? stats.volume : '-' }}</b><span>{{ $t('companion.status.volume') }}</span></div>
                    </div>
                    <dl class="facts">
                      <dt>{{ $t('companion.status.lastTouch') }}</dt>
                      <dd>{{ stats.last_touch_s !== undefined ? secondsAgoText(stats.last_touch_s) : '-' }}</dd>
                      <dt>{{ $t('companion.status.highScores') }}</dt>
                      <dd>
                        <span v-if="!scores.length">-</span>
                        <span v-for="s in scores" :key="s.game" class="score">{{ gameName(s.game) }} {{ s.value }}{{ s.ms ? ' ms' : '' }}</span>
                      </dd>
                      <dt>{{ $t('companion.status.firmware') }}</dt>
                      <dd>{{ stats.fw || '-' }}</dd>
                      <dt>{{ $t('companion.status.ip') }}</dt>
                      <dd>{{ stats.ip || '-' }}</dd>
                      <dt>{{ $t('companion.status.rssi') }}</dt>
                      <dd>{{ stats.rssi ? stats.rssi + ' dBm' : '-' }}</dd>
                    </dl>
                  </div>

                  <div class="panel">
                    <h3>{{ $t('companion.status.weather') }}</h3>
                    <template v-if="weather.ok">
                      <div class="big">{{ weather.temp }}° · {{ weather.text }}</div>
                      <div class="muted small">{{ weather.city }}</div>
                      <div class="small">
                        {{ $t('companion.status.weatherDetail', { hi: weather.hi, lo: weather.lo, rain: weather.rain_prob }) }}
                      </div>
                    </template>
                    <div v-else class="muted">{{ $t('companion.status.noWeather') }}</div>
                    <template v-if="prayer.enabled && upcomingPrayer">
                      <h3 class="spaced">{{ $t('companion.status.nextPrayer') }}</h3>
                      <div class="big">
                        {{ $t('companion.prayer.' + upcomingPrayer.key) }} {{ upcomingPrayer.time }}
                        <span v-if="upcomingPrayer.tomorrow" class="muted small">({{ $t('companion.prayer.tomorrow') }})</span>
                      </div>
                    </template>
                  </div>
                </div>

                <div class="panel">
                  <div class="row spread">
                    <h3>{{ $t('companion.status.events') }}</h3>
                    <el-button size="mini" :loading="loadingEvents" @click="loadMoreEvents">{{ $t('companion.status.moreEvents') }}</el-button>
                  </div>
                  <el-empty v-if="!eventList.length" :image-size="60" :description="$t('companion.status.noEvents')" />
                  <ul v-else class="list">
                    <li v-for="(e, i) in eventList" :key="i + '-' + (e.rx || e.ts)">
                      <span class="grow">{{ eventText(e) }}</span>
                      <span class="muted small">{{ ago(e.rx || e.ts) }}</span>
                    </li>
                  </ul>
                </div>
              </el-tab-pane>

              <!-- Alarms -->
              <el-tab-pane :label="$t('companion.tab.alarms')" name="alarms">
                <div class="panel">
                  <div class="row spread">
                    <h3>{{ $t('companion.tab.alarms') }} ({{ alarms.length }}/{{ maxAlarms }})</h3>
                    <el-button type="primary" size="small" icon="el-icon-plus" :disabled="alarms.length >= maxAlarms"
                      @click="openAlarm(null)">{{ $t('companion.alarm.add') }}</el-button>
                  </div>
                  <el-empty v-if="!alarms.length" :image-size="60" :description="$t('companion.alarm.none')" />
                  <ul v-else class="list">
                    <li v-for="a in sortedAlarms" :key="a.id" :class="{ disabled: !a.enabled }">
                      <div class="time">{{ a.time }}</div>
                      <div class="grow clickable" @click="openAlarm(a)">
                        <div>{{ a.label || $t('companion.alarm.defaultLabel') }}</div>
                        <div class="muted small">
                          {{ daysText(a.days) }}
                          <span v-if="a.snooze_min"> · {{ $t('companion.alarm.snoozeShort', { min: a.snooze_min }) }}</span>
                          <span v-if="a.say"> · <i class="el-icon-microphone"></i> {{ a.say }}</span>
                        </div>
                      </div>
                      <el-switch :value="a.enabled" @change="(v) => toggleAlarm(a, v)" />
                      <el-button type="text" size="mini" icon="el-icon-edit" @click="openAlarm(a)" />
                      <el-button type="text" size="mini" icon="el-icon-delete" class="danger-text" @click="deleteAlarm(a)" />
                    </li>
                  </ul>
                </div>
              </el-tab-pane>

              <!-- Reminders -->
              <el-tab-pane :label="$t('companion.tab.reminders')" name="reminders">
                <div class="panel">
                  <div class="row spread wrap">
                    <h3>{{ $t('companion.tab.reminders') }} ({{ reminders.length }}/{{ maxReminders }})</h3>
                    <div class="button-row">
                      <el-button v-for="kind in reminderKinds" :key="kind" size="small" icon="el-icon-plus"
                        :disabled="reminders.length >= maxReminders" @click="openReminder(null, kind)">
                        {{ $t('companion.reminder.kind.' + kind) }}
                      </el-button>
                    </div>
                  </div>
                  <el-empty v-if="!reminders.length" :image-size="60" :description="$t('companion.reminder.none')" />
                  <ul v-else class="list">
                    <li v-for="r in reminders" :key="r.id" :class="{ disabled: !r.enabled }">
                      <el-tag size="mini" :type="kindTagType(r.kind)">{{ $t('companion.reminder.kind.' + r.kind) }}</el-tag>
                      <div class="grow clickable" @click="openReminder(r)">
                        <div>{{ r.label }}</div>
                        <div class="muted small">
                          {{ reminderWhen(r) }}
                          <span v-if="r.say"> · <i class="el-icon-microphone"></i> {{ r.say }}</span>
                        </div>
                      </div>
                      <el-switch :value="r.enabled" @change="(v) => toggleReminder(r, v)" />
                      <el-button type="text" size="mini" icon="el-icon-edit" @click="openReminder(r)" />
                      <el-button type="text" size="mini" icon="el-icon-delete" class="danger-text" @click="deleteReminder(r)" />
                    </li>
                  </ul>
                </div>
              </el-tab-pane>

              <!-- Prayer -->
              <el-tab-pane :label="$t('companion.tab.prayer')" name="prayer">
                <div class="grid">
                  <div class="panel">
                    <h3>{{ $t('companion.tab.prayer') }}</h3>
                    <div class="toggle-row">
                      <span>{{ $t('companion.prayer.enable') }}</span>
                      <el-switch :value="!!prayer.enabled" :disabled="saving.prayer" @change="(v) => savePrayer({ enabled: v })" />
                    </div>
                    <div class="toggle-row">
                      <span>{{ $t('companion.prayer.remind') }}</span>
                      <el-switch :value="!!prayer.remind" :disabled="saving.prayer" @change="(v) => savePrayer({ remind: v })" />
                    </div>
                    <div class="muted small">{{ $t('companion.prayer.city') }}: {{ prayer.city || '-' }}
                      · {{ $t('companion.prayer.weatherCity') }}: {{ weather.city || '-' }}</div>

                    <template v-if="prayer.enabled && prayerDays.length">
                      <table class="times">
                        <thead>
                          <tr>
                            <th></th>
                            <th>{{ $t('companion.prayer.today') }} {{ shortDate(prayerDays[0].date) }}</th>
                            <th v-if="prayerDays[1]">{{ $t('companion.prayer.tomorrow') }} {{ shortDate(prayerDays[1].date) }}</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr v-for="k in prayerRows" :key="k"
                            :class="{ next: upcomingPrayer && !upcomingPrayer.tomorrow && upcomingPrayer.key === k }">
                            <td>{{ $t('companion.prayer.' + k) }}</td>
                            <td>{{ prayerDays[0][k] || '-' }}</td>
                            <td v-if="prayerDays[1]">{{ prayerDays[1][k] || '-' }}</td>
                          </tr>
                        </tbody>
                      </table>
                      <div class="hint">{{ $t('companion.prayer.methodHint') }}</div>
                    </template>
                    <div v-else-if="prayer.enabled" class="muted small spaced">{{ $t('companion.prayer.noTimes') }}</div>
                  </div>

                  <div class="panel">
                    <h3>{{ $t('companion.prayer.changeCity') }}</h3>
                    <div class="row">
                      <el-input v-model="cityQuery" size="small" clearable :placeholder="$t('companion.prayer.cityPlaceholder')"
                        @keyup.enter.native="searchCity" />
                      <el-button type="primary" size="small" icon="el-icon-search" :loading="citySearching"
                        @click="searchCity">{{ $t('companion.prayer.search') }}</el-button>
                    </div>
                    <el-checkbox v-model="citySameWeather" class="spaced">{{ $t('companion.prayer.sameForWeather') }}</el-checkbox>
                    <div v-if="citySearched && !cityResults.length && !citySearching" class="muted small spaced">
                      {{ $t('companion.prayer.noResults') }}
                    </div>
                    <ul class="list">
                      <li v-for="(r, i) in cityResults" :key="i" class="clickable" @click="chooseCity(r)">
                        <div class="grow">
                          <div>{{ r.name }}</div>
                          <div class="muted small">{{ cityDetail(r) }}</div>
                        </div>
                        <i class="el-icon-arrow-right"></i>
                      </li>
                    </ul>
                  </div>
                </div>
              </el-tab-pane>

              <!-- Focus timer -->
              <el-tab-pane :label="$t('companion.tab.focus')" name="focus">
                <div class="panel narrow">
                  <h3>{{ $t('companion.focus.title') }}</h3>
                  <el-form label-position="top" size="small" class="form-grid">
                    <el-form-item :label="$t('companion.focus.work')">
                      <el-input-number v-model="forms.pomodoro.work_min" :min="1" :max="120" />
                    </el-form-item>
                    <el-form-item :label="$t('companion.focus.rounds')">
                      <el-input-number v-model="forms.pomodoro.rounds" :min="1" :max="12" />
                    </el-form-item>
                    <el-form-item :label="$t('companion.focus.shortBreak')">
                      <el-input-number v-model="forms.pomodoro.short_break_min" :min="1" :max="60" />
                    </el-form-item>
                    <el-form-item :label="$t('companion.focus.longBreak')">
                      <el-input-number v-model="forms.pomodoro.long_break_min" :min="1" :max="90" />
                    </el-form-item>
                  </el-form>
                  <div class="hint">
                    {{ $t('companion.focus.hint', { rounds: forms.pomodoro.rounds, done: stats.pomodoros_today || 0 }) }}
                  </div>
                  <div class="button-row spaced">
                    <el-button size="small" :disabled="!isDirty('pomodoro')" :loading="saving.pomodoro"
                      @click="saveSection('pomodoro')">{{ $t('companion.save') }}</el-button>
                    <el-button type="primary" size="small" icon="el-icon-video-play" :loading="commandBusy === 'pomodoro'"
                      @click="sendCommand('pomodoro', forms.pomodoro.work_min, $t('companion.focus.started'))">
                      {{ $t('companion.focus.startNow') }}
                    </el-button>
                  </div>
                </div>
              </el-tab-pane>

              <!-- Messages -->
              <el-tab-pane :label="$t('companion.tab.messages')" name="messages">
                <div class="grid">
                  <div class="panel">
                    <h3>{{ $t('companion.message.send') }}</h3>
                    <el-form label-position="top" size="small">
                      <el-form-item :label="$t('companion.message.from')">
                        <el-input v-model="message.from" :maxlength="maxName" placeholder="Ammu" />
                        <div class="hint">{{ $t('companion.message.fromHint') }}</div>
                      </el-form-item>
                      <el-form-item :label="$t('companion.message.text')">
                        <el-input v-model="message.text" type="textarea" :rows="3" :maxlength="maxMessage" show-word-limit
                          :placeholder="$t('companion.message.textPlaceholder')" />
                        <div class="hint">{{ $t('companion.message.textHint') }}</div>
                      </el-form-item>
                      <div class="toggle-row">
                        <span>{{ $t('companion.message.ask') }}</span>
                        <el-switch v-model="message.ask" />
                      </div>
                      <el-button type="primary" size="small" icon="el-icon-s-promotion" :loading="sendingMessage"
                        @click="sendMessage">{{ $t('companion.message.sendButton') }}</el-button>
                    </el-form>
                  </div>
                  <div class="panel">
                    <h3>{{ $t('companion.message.sent') }}</h3>
                    <el-empty v-if="!messages.length" :image-size="60" :description="$t('companion.message.none')" />
                    <ul v-else class="list">
                      <li v-for="m in messages" :key="m.id">
                        <div class="grow">
                          <div class="msg-text">{{ m.text }}</div>
                          <div class="muted small">
                            <span v-if="m.from">{{ m.from }} · </span>{{ clock(m.ts) }}
                            <span v-if="m.ask"> · {{ $t('companion.message.askShort') }}</span>
                          </div>
                        </div>
                        <el-tag size="mini" :type="statusTagType(m)">{{ $t('companion.message.status.' + statusOf(m)) }}</el-tag>
                      </li>
                    </ul>
                  </div>
                </div>
              </el-tab-pane>

              <!-- Night & care -->
              <el-tab-pane :label="$t('companion.tab.night')" name="night">
                <div class="grid">
                  <div class="panel">
                    <h3>{{ $t('companion.night.title') }}</h3>
                    <div class="toggle-row">
                      <span>{{ $t('companion.night.enabled') }}</span>
                      <el-switch v-model="forms.night.enabled" />
                    </div>
                    <div class="row">
                      <div class="field">
                        <label>{{ $t('companion.night.start') }}</label>
                        <el-time-picker v-model="forms.night.start" value-format="HH:mm" format="HH:mm" size="small"
                          :clearable="false" class="time-input" />
                      </div>
                      <div class="field">
                        <label>{{ $t('companion.night.end') }}</label>
                        <el-time-picker v-model="forms.night.end" value-format="HH:mm" format="HH:mm" size="small"
                          :clearable="false" class="time-input" />
                      </div>
                    </div>
                    <div class="toggle-row">
                      <span>{{ $t('companion.night.dim') }}</span>
                      <el-switch v-model="forms.night.dim" />
                    </div>
                    <div class="toggle-row">
                      <span>{{ $t('companion.night.lullaby') }}</span>
                      <el-switch v-model="forms.night.lullaby" />
                    </div>
                    <div class="toggle-row">
                      <span>{{ $t('companion.night.light') }}</span>
                      <el-switch v-model="forms.night.light" />
                    </div>
                    <el-button size="small" type="primary" :disabled="!isDirty('night')" :loading="saving.night"
                      @click="saveSection('night')">{{ $t('companion.save') }}</el-button>
                  </div>
                  <div class="panel">
                    <h3>{{ $t('companion.care.title') }}</h3>
                    <div class="toggle-row">
                      <span>{{ $t('companion.care.enabled') }}</span>
                      <el-switch v-model="forms.care.enabled" />
                    </div>
                    <div class="field">
                      <label>{{ $t('companion.care.lonelyAfter') }}</label>
                      <el-input-number v-model="forms.care.lonely_after_min" :min="10" :max="1440" :step="10" size="small" />
                    </div>
                    <div class="hint">{{ $t('companion.care.hint') }}</div>
                    <el-button size="small" type="primary" class="spaced" :disabled="!isDirty('care')" :loading="saving.care"
                      @click="saveSection('care')">{{ $t('companion.save') }}</el-button>
                  </div>
                </div>
              </el-tab-pane>

              <!-- Volume, sounds and robot names -->
              <el-tab-pane :label="$t('companion.tab.sound')" name="sound">
                <div class="grid">
                  <div class="panel">
                    <h3>{{ $t('companion.sound.title') }}</h3>
                    <div class="toggle-row">
                      <span>{{ $t('companion.sound.controlVolume') }}</span>
                      <el-switch v-model="forms.sound.controlVolume" />
                    </div>
                    <div class="field">
                      <label>{{ $t('companion.sound.volume') }}</label>
                      <el-slider v-model="forms.sound.volume" :min="0" :max="100" :step="5" show-input
                        :disabled="!forms.sound.controlVolume" />
                      <div v-if="!forms.sound.controlVolume" class="hint">{{ $t('companion.sound.autoHint') }}</div>
                    </div>
                    <div class="toggle-row">
                      <span>{{ $t('companion.sound.sounds') }}</span>
                      <el-switch v-model="forms.sound.sounds" />
                    </div>
                    <el-button size="small" type="primary" :disabled="!isDirty('sound')" :loading="saving.sound"
                      @click="saveSection('sound')">{{ $t('companion.save') }}</el-button>
                  </div>
                  <div class="panel">
                    <h3>{{ $t('companion.robot.title') }}</h3>
                    <el-form label-position="top" size="small">
                      <el-form-item :label="$t('companion.robot.name')">
                        <el-input v-model="forms.robot.name" :maxlength="maxName" />
                      </el-form-item>
                      <el-form-item :label="$t('companion.robot.ownerName')">
                        <el-input v-model="forms.robot.owner_name" :maxlength="maxName" />
                        <div class="hint">{{ $t('companion.robot.ownerHint', sayTokens) }}</div>
                      </el-form-item>
                    </el-form>
                    <el-button size="small" type="primary" :disabled="!isDirty('robot')" :loading="saving.robot"
                      @click="saveSection('robot')">{{ $t('companion.save') }}</el-button>
                    <div class="hint spaced">ID {{ dev.id }}</div>
                  </div>
                </div>
              </el-tab-pane>

              <!-- Quick actions -->
              <el-tab-pane :label="$t('companion.tab.actions')" name="actions">
                <div class="grid">
                  <div class="panel">
                    <h3>{{ $t('companion.action.story') }}</h3>
                    <div class="row">
                      <el-input v-model="storyTopic" size="small" maxlength="64" clearable
                        :placeholder="$t('companion.action.storyTopic')" @keyup.enter.native="sendStory" />
                      <el-button type="primary" size="small" :loading="commandBusy === 'story'" @click="sendStory">
                        {{ $t('companion.action.tellStory') }}
                      </el-button>
                    </div>
                    <h3 class="spaced">{{ $t('companion.action.quick') }}</h3>
                    <div class="button-row">
                      <el-button v-for="a in quickActions" :key="a.type + a.arg" size="small" :icon="a.icon"
                        :loading="commandBusy === a.type + a.arg" @click="sendCommand(a.type, a.arg, null, a.type + a.arg)">
                        {{ $t(a.label) }}
                      </el-button>
                    </div>
                    <h3 class="spaced">{{ $t('companion.action.games') }}</h3>
                    <div class="button-row">
                      <el-button v-for="g in games" :key="g" size="small" icon="el-icon-trophy"
                        :loading="commandBusy === 'game' + g" @click="sendCommand('game', g, null, 'game' + g)">
                        {{ gameName(g) }}
                      </el-button>
                    </div>
                  </div>
                  <div class="panel">
                    <h3>{{ $t('companion.action.recent') }}</h3>
                    <el-empty v-if="!commands.length" :image-size="60" :description="$t('companion.action.noCommands')" />
                    <ul v-else class="list">
                      <li v-for="c in commands.slice(0, 10)" :key="c.id">
                        <span class="grow">{{ commandName(c) }}</span>
                        <span class="muted small">{{ ago(c.ts) }}</span>
                        <el-tag size="mini" :type="c.status === 'done' ? 'success' : 'warning'">
                          {{ $t(c.status === 'done' ? 'companion.action.done' : 'companion.action.pending') }}
                        </el-tag>
                      </li>
                    </ul>
                  </div>
                </div>
              </el-tab-pane>
            </el-tabs>
          </el-card>
        </div>
      </div>
    </div>

    <!-- Alarm dialog -->
    <el-dialog :title="alarmDialog.isNew ? $t('companion.alarm.add') : $t('companion.alarm.edit')"
      :visible.sync="alarmDialog.visible" :width="dialogWidth" :append-to-body="true" :close-on-click-modal="false">
      <el-form v-if="alarmDialog.form" label-position="top" size="small">
        <el-form-item :label="$t('companion.alarm.time')">
          <el-time-picker v-model="alarmDialog.form.time" value-format="HH:mm" format="HH:mm" :clearable="false"
            class="time-input" />
        </el-form-item>
        <el-form-item :label="$t('companion.days')">
          <div class="chips">
            <button v-for="d in 7" :key="'d' + d" type="button" class="chip"
              :class="{ on: hasDay(alarmDialog.form.days, d - 1) }" :aria-pressed="hasDay(alarmDialog.form.days, d - 1) ? 'true' : 'false'"
              @click="alarmDialog.form.days = toggleDay(alarmDialog.form.days, d - 1)">{{ $t('companion.day.' + (d - 1)) }}</button>
          </div>
          <div class="chips">
            <button v-for="p in dayPresets" :key="p.key" type="button" class="chip preset"
              :class="{ on: alarmDialog.form.days === p.mask }" @click="alarmDialog.form.days = p.mask">
              {{ $t('companion.preset.' + p.key) }}</button>
          </div>
          <div class="hint">{{ daysText(alarmDialog.form.days) }}</div>
        </el-form-item>
        <el-form-item :label="$t('companion.label')">
          <el-input :value="alarmDialog.form.label" :maxlength="maxLabel" show-word-limit
            @input="(v) => alarmDialog.form.label = asciiLabel(v)" />
          <div class="hint">{{ $t('companion.labelHint') }}</div>
        </el-form-item>
        <el-form-item :label="$t('companion.say')">
          <el-input v-model="alarmDialog.form.say" type="textarea" :rows="2" :maxlength="maxSay" show-word-limit
            :placeholder="$t('companion.alarm.sayPlaceholder', sayTokens)" />
          <div class="hint">{{ $t('companion.sayHint', sayTokens) }}</div>
        </el-form-item>
        <el-form-item :label="$t('companion.alarm.snooze')">
          <el-input-number v-model="alarmDialog.form.snooze_min" :min="0" :max="60" />
        </el-form-item>
        <div class="toggle-row">
          <span>{{ $t('companion.enabled') }}</span>
          <el-switch v-model="alarmDialog.form.enabled" />
        </div>
      </el-form>
      <span slot="footer" class="dialog-footer">
        <el-button @click="alarmDialog.visible = false">{{ $t('button.cancel') }}</el-button>
        <el-button type="primary" :loading="saving.alarms" @click="saveAlarm">{{ $t('companion.save') }}</el-button>
      </span>
    </el-dialog>

    <!-- Reminder dialog -->
    <el-dialog :title="reminderDialog.isNew ? $t('companion.reminder.add') : $t('companion.reminder.edit')"
      :visible.sync="reminderDialog.visible" :width="dialogWidth" :append-to-body="true" :close-on-click-modal="false">
      <el-form v-if="reminderDialog.form" label-position="top" size="small">
        <el-form-item :label="$t('companion.reminder.kindLabel')">
          <el-select v-model="reminderDialog.form.kind">
            <el-option v-for="kind in reminderKinds" :key="kind" :value="kind" :label="$t('companion.reminder.kind.' + kind)" />
          </el-select>
        </el-form-item>
        <el-form-item :label="$t('companion.reminder.mode')">
          <el-radio-group v-model="reminderDialog.form.mode">
            <el-radio-button label="interval">{{ $t('companion.reminder.modeInterval') }}</el-radio-button>
            <el-radio-button label="time">{{ $t('companion.reminder.modeTime') }}</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <template v-if="reminderDialog.form.mode === 'interval'">
          <el-form-item :label="$t('companion.reminder.every')">
            <el-input-number v-model="reminderDialog.form.every_min" :min="5" :max="720" :step="5" />
          </el-form-item>
          <div class="row">
            <el-form-item :label="$t('companion.reminder.from')">
              <el-time-picker v-model="reminderDialog.form.from" value-format="HH:mm" format="HH:mm" :clearable="false"
                class="time-input" />
            </el-form-item>
            <el-form-item :label="$t('companion.reminder.to')">
              <el-time-picker v-model="reminderDialog.form.to" value-format="HH:mm" format="HH:mm" :clearable="false"
                class="time-input" />
            </el-form-item>
          </div>
        </template>
        <el-form-item v-else :label="$t('companion.reminder.time')">
          <el-time-picker v-model="reminderDialog.form.time" value-format="HH:mm" format="HH:mm" :clearable="false"
            class="time-input" />
        </el-form-item>
        <el-form-item :label="$t('companion.days')">
          <div class="chips">
            <button v-for="d in 7" :key="'d' + d" type="button" class="chip"
              :class="{ on: hasDay(reminderDialog.form.days, d - 1) }" :aria-pressed="hasDay(reminderDialog.form.days, d - 1) ? 'true' : 'false'"
              @click="reminderDialog.form.days = toggleDay(reminderDialog.form.days, d - 1)">{{ $t('companion.day.' + (d - 1)) }}</button>
          </div>
          <div class="chips">
            <button v-for="p in dayPresets" :key="p.key" type="button" class="chip preset"
              :class="{ on: reminderDialog.form.days === p.mask }" @click="reminderDialog.form.days = p.mask">
              {{ $t('companion.preset.' + p.key) }}</button>
          </div>
        </el-form-item>
        <el-form-item :label="$t('companion.label')">
          <el-input :value="reminderDialog.form.label" :maxlength="maxLabel" show-word-limit
            @input="(v) => reminderDialog.form.label = asciiLabel(v)" />
          <div class="hint">{{ $t('companion.labelHint') }}</div>
        </el-form-item>
        <el-form-item :label="$t('companion.say')">
          <el-input v-model="reminderDialog.form.say" type="textarea" :rows="2" :maxlength="maxSay" show-word-limit />
          <div class="hint">{{ $t('companion.sayHint', sayTokens) }}</div>
        </el-form-item>
        <div class="toggle-row">
          <span>{{ $t('companion.enabled') }}</span>
          <el-switch v-model="reminderDialog.form.enabled" />
        </div>
      </el-form>
      <span slot="footer" class="dialog-footer">
        <el-button @click="reminderDialog.visible = false">{{ $t('button.cancel') }}</el-button>
        <el-button type="primary" :loading="saving.reminders" @click="saveReminder">{{ $t('companion.save') }}</el-button>
      </span>
    </el-dialog>

    <el-footer>
      <version-footer />
    </el-footer>
  </div>
</template>

<script>
import Api from '@/apis/api';
import HeaderBar from '@/components/HeaderBar.vue';
import VersionFooter from '@/components/VersionFooter.vue';
import {
  DAY_PRESETS,
  GAMES,
  MAX_ALARMS,
  MAX_LABEL,
  MAX_MESSAGE,
  MAX_NAME,
  MAX_REMINDERS,
  MAX_SAY,
  PRAYER_ROWS,
  REMINDER_KINDS,
  ageOf,
  alarmPayload,
  asciiLabel,
  daysOf,
  daysPreset,
  formatClock,
  hasDay,
  highScores,
  isTime,
  messageStatus,
  newAlarm,
  newReminder,
  nextPrayer,
  reminderPayload,
  removeById,
  setEnabled,
  toggleDay,
  upsertById,
} from '@/utils/companion.mjs';

const REFRESH_MS = 10000;
const FROM_KEY = 'companion_message_from';
const FORM_SECTIONS = ['pomodoro', 'night', 'care', 'sound', 'robot'];

const MOOD_EMOJI = {
  Happy: '😊', Sad: '😢', Sleepy: '😴', Bored: '😐', Excited: '🤩', Angry: '😠', Lonely: '🥺', Love: '🥰', Calm: '🙂',
};

function readFrom() {
  try {
    return localStorage.getItem(FROM_KEY) || '';
  } catch (e) {
    return '';
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value === undefined ? null : value));
}

export default {
  name: 'CompanionManagement',
  components: { HeaderBar, VersionFooter },
  data() {
    return {
      deviceId: this.$route.query.deviceId || '',
      agentId: this.$route.query.agentId || '',
      dev: null,
      loading: false,
      inflight: false,
      loadError: '',
      activeTab: 'status',
      pollTimer: null,
      windowWidth: window.innerWidth,
      // Editable copies of the config; refreshed from the server only while unchanged.
      forms: {
        pomodoro: {},
        night: {},
        care: {},
        sound: { controlVolume: false, volume: 70, sounds: true },
        robot: { name: '', owner_name: '' },
      },
      baseline: {},
      saving: {
        pomodoro: false, night: false, care: false, sound: false, robot: false,
        alarms: false, reminders: false, prayer: false,
      },
      alarmDialog: { visible: false, isNew: true, form: null },
      reminderDialog: { visible: false, isNew: true, form: null },
      cityQuery: '',
      cityResults: [],
      citySearching: false,
      citySearched: false,
      citySameWeather: true,
      message: { from: readFrom(), text: '', ask: true },
      sendingMessage: false,
      storyTopic: '',
      commandBusy: '',
      moreEvents: null,
      loadingEvents: false,
      now: Date.now(),
      maxAlarms: MAX_ALARMS,
      maxReminders: MAX_REMINDERS,
      maxLabel: MAX_LABEL,
      maxSay: MAX_SAY,
      maxMessage: MAX_MESSAGE,
      maxName: MAX_NAME,
      dayPresets: DAY_PRESETS,
      reminderKinds: REMINDER_KINDS,
      prayerRows: PRAYER_ROWS,
      games: GAMES,
      // Literal placeholders the server fills in; passed as params so vue-i18n keeps the braces
      sayTokens: { weather: '{weather}', date: '{date}', name: '{name}' },
      quickActions: [
        { type: 'lullaby', arg: '', icon: 'el-icon-headset', label: 'companion.action.lullaby' },
        { type: 'ring', arg: '', icon: 'el-icon-bell', label: 'companion.action.ring' },
        { type: 'breathe', arg: '', icon: 'el-icon-wind-power', label: 'companion.action.breathe' },
        { type: 'night_light', arg: 'on', icon: 'el-icon-sunny', label: 'companion.action.nightLightOn' },
        { type: 'night_light', arg: 'off', icon: 'el-icon-moon', label: 'companion.action.nightLightOff' },
      ],
    };
  },
  computed: {
    stats() {
      return (this.dev && this.dev.stats) || {};
    },
    weather() {
      return (this.dev && this.dev.weather) || {};
    },
    prayer() {
      return (this.dev && this.dev.prayer) || {};
    },
    prayerDays() {
      return Array.isArray(this.prayer.days) ? this.prayer.days : [];
    },
    upcomingPrayer() {
      return nextPrayer(this.prayerDays, new Date(this.now));
    },
    alarms() {
      return (this.dev && this.dev.alarms) || [];
    },
    sortedAlarms() {
      return this.alarms.slice().sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
    },
    reminders() {
      return (this.dev && this.dev.reminders) || [];
    },
    messages() {
      return (this.dev && this.dev.messages) || [];
    },
    commands() {
      return (this.dev && this.dev.commands) || [];
    },
    eventList() {
      return this.moreEvents || (this.dev && this.dev.events) || [];
    },
    scores() {
      return highScores(this.stats.high_scores);
    },
    dialogWidth() {
      return this.windowWidth < 600 ? '94%' : '520px';
    },
  },
  mounted() {
    window.addEventListener('resize', this.onResize);
    document.addEventListener('visibilitychange', this.onVisibility);
    if (this.deviceId) {
      this.refresh(false);
      this.pollTimer = setInterval(() => {
        if (!document.hidden) this.refresh(true);
      }, REFRESH_MS);
    }
  },
  beforeDestroy() {
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('visibilitychange', this.onVisibility);
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  },
  methods: {
    hasDay,
    toggleDay,
    asciiLabel,
    onResize() {
      this.windowWidth = window.innerWidth;
    },
    onVisibility() {
      if (!document.hidden && this.deviceId) this.refresh(true);
    },
    goBack() {
      if (this.agentId) {
        this.$router.push({ name: 'DeviceManagement', query: { agentId: this.agentId } });
      } else {
        this.$router.back();
      }
    },
    errorText(err) {
      return (err && err.data && err.data.msg) || this.$t('companion.requestFailed');
    },

    // ------------------------------------------------------------------ data
    refresh(silent) {
      if (!this.deviceId || this.inflight) return;
      this.inflight = true;
      if (!silent) this.loading = true;
      Api.companion.getCompanion(this.deviceId, (res) => {
        this.inflight = false;
        this.loading = false;
        this.loadError = '';
        this.applyDevice(res.data.data);
      }, (err) => {
        this.inflight = false;
        this.loading = false;
        // Keep showing the last good data on a failed background refresh
        if (!silent || !this.dev) this.loadError = this.errorText(err);
      });
    },
    applyDevice(view) {
      if (!view || typeof view !== 'object') return;
      this.dev = view;
      this.now = Date.now();
      this.syncForms(false);
    },
    serverForm(section) {
      const dev = this.dev || {};
      const settings = dev.settings || {};
      switch (section) {
        case 'pomodoro':
          return clone(dev.pomodoro || {});
        case 'night':
          return clone(settings.night || {});
        case 'care':
          return clone(settings.care || {});
        case 'sound': {
          const manual = settings.volume !== null && settings.volume !== undefined;
          const fallback = this.stats.volume !== undefined ? this.stats.volume : 70;
          return { controlVolume: manual, volume: manual ? settings.volume : fallback, sounds: settings.sounds !== false };
        }
        case 'robot':
          return { name: dev.name || '', owner_name: settings.owner_name || '' };
        default:
          return {};
      }
    },
    // Replace the editable copies with the server values, except sections with unsaved edits
    // (unless force: after saving that section).
    syncForms(force, only) {
      FORM_SECTIONS.forEach((section) => {
        if (only && section !== only) return;
        if (force || !this.isDirty(section)) {
          const value = this.serverForm(section);
          this.forms[section] = value;
          this.$set(this.baseline, section, JSON.stringify(value));
        }
      });
    },
    isDirty(section) {
      const base = this.baseline[section];
      return base !== undefined && JSON.stringify(this.forms[section]) !== base;
    },
    savePatch(patch, savingKey, okMessage) {
      return new Promise((resolve, reject) => {
        this.saving[savingKey] = true;
        Api.companion.updateCompanionConfig(this.deviceId, patch, (res) => {
          this.saving[savingKey] = false;
          this.applyDevice(res.data.data);
          this.$message.success(okMessage || this.$t('companion.saved'));
          resolve(res.data.data);
        }, (err) => {
          this.saving[savingKey] = false;
          this.$message.error(this.errorText(err));
          reject(err);
        });
      });
    },
    sectionPatch(section) {
      const form = this.forms[section];
      switch (section) {
        case 'pomodoro':
          return { pomodoro: { ...form } };
        case 'night':
          return { settings: { night: { ...form } } };
        case 'care':
          return { settings: { care: { ...form } } };
        case 'sound':
          return { settings: { volume: form.controlVolume ? form.volume : null, sounds: !!form.sounds } };
        case 'robot':
          return {
            name: (form.name || '').trim() || 'TinyBot',
            settings: { owner_name: (form.owner_name || '').trim() },
          };
        default:
          return {};
      }
    },
    saveSection(section) {
      if (section === 'night' && (!isTime(this.forms.night.start) || !isTime(this.forms.night.end))) {
        this.$message.warning(this.$t('companion.timeRequired'));
        return;
      }
      this.savePatch(this.sectionPatch(section), section)
        .then(() => this.syncForms(true, section))
        .catch(() => {});
    },

    // ------------------------------------------------------------------ alarms
    openAlarm(alarm) {
      this.alarmDialog = {
        visible: true,
        isNew: !alarm,
        form: alarm ? { ...alarmPayload(alarm), label: alarm.label || '' } : newAlarm(),
      };
    },
    saveAlarm() {
      const form = this.alarmDialog.form;
      if (!isTime(form.time)) {
        this.$message.warning(this.$t('companion.timeRequired'));
        return;
      }
      const list = upsertById(this.alarms, form, alarmPayload);
      this.savePatch({ alarms: list }, 'alarms')
        .then(() => { this.alarmDialog.visible = false; })
        .catch(() => {});
    },
    toggleAlarm(alarm, enabled) {
      this.savePatch({ alarms: setEnabled(this.alarms, alarm.id, enabled, alarmPayload) }, 'alarms',
        this.$t(enabled ? 'companion.alarm.enabledMsg' : 'companion.alarm.disabledMsg')).catch(() => {});
    },
    deleteAlarm(alarm) {
      this.$confirm(this.$t('companion.alarm.confirmDelete', { time: alarm.time }), this.$t('message.warning'), {
        confirmButtonText: this.$t('button.ok'),
        cancelButtonText: this.$t('button.cancel'),
        type: 'warning',
      }).then(() => {
        this.savePatch({ alarms: removeById(this.alarms, alarm.id, alarmPayload) }, 'alarms',
          this.$t('companion.deleted')).catch(() => {});
      }).catch(() => {});
    },

    // ------------------------------------------------------------------ reminders
    openReminder(reminder, kind) {
      // Keep defaults for the fields of the other mode so switching modes in the dialog works
      const form = reminder ? { ...newReminder(reminder.kind), ...clone(reminder) } : newReminder(kind);
      delete form.say_audio;
      this.reminderDialog = { visible: true, isNew: !reminder, form };
    },
    saveReminder() {
      const form = this.reminderDialog.form;
      const times = form.mode === 'interval' ? [form.from, form.to] : [form.time];
      if (!times.every(isTime)) {
        this.$message.warning(this.$t('companion.timeRequired'));
        return;
      }
      const list = upsertById(this.reminders, form, reminderPayload);
      this.savePatch({ reminders: list }, 'reminders')
        .then(() => { this.reminderDialog.visible = false; })
        .catch(() => {});
    },
    toggleReminder(reminder, enabled) {
      this.savePatch({ reminders: setEnabled(this.reminders, reminder.id, enabled, reminderPayload) }, 'reminders')
        .catch(() => {});
    },
    deleteReminder(reminder) {
      this.$confirm(this.$t('companion.reminder.confirmDelete'), this.$t('message.warning'), {
        confirmButtonText: this.$t('button.ok'),
        cancelButtonText: this.$t('button.cancel'),
        type: 'warning',
      }).then(() => {
        this.savePatch({ reminders: removeById(this.reminders, reminder.id, reminderPayload) }, 'reminders',
          this.$t('companion.deleted')).catch(() => {});
      }).catch(() => {});
    },
    reminderWhen(r) {
      if (r.mode === 'interval') {
        return this.$t('companion.reminder.whenInterval', { every: r.every_min, from: r.from, to: r.to })
          + ' · ' + this.daysText(r.days);
      }
      return r.time + ' · ' + this.daysText(r.days);
    },
    kindTagType(kind) {
      return { water: '', medicine: 'danger', custom: 'info' }[kind] || 'info';
    },

    // ------------------------------------------------------------------ prayer
    savePrayer(patch) {
      this.savePatch({ prayer: patch }, 'prayer').catch(() => {});
    },
    searchCity() {
      const query = (this.cityQuery || '').trim();
      if (query.length < 2) {
        this.$message.warning(this.$t('companion.prayer.queryTooShort'));
        return;
      }
      this.citySearching = true;
      Api.companion.geocodeCity(query, (res) => {
        this.citySearching = false;
        this.citySearched = true;
        const data = res.data.data || {};
        this.cityResults = Array.isArray(data.results) ? data.results : [];
      }, (err) => {
        this.citySearching = false;
        this.citySearched = true;
        this.cityResults = [];
        this.$message.error(this.errorText(err));
      });
    },
    chooseCity(result) {
      const location = { city: result.name, lat: Number(result.lat), lon: Number(result.lon) };
      const patch = { prayer: location };
      if (this.citySameWeather) patch.weather = { ...location };
      this.savePatch(patch, 'prayer', this.$t('companion.prayer.citySet', { city: result.name }))
        .then(() => {
          this.cityResults = [];
          this.citySearched = false;
          this.cityQuery = '';
        })
        .catch(() => {});
    },
    cityDetail(r) {
      const place = [r.admin1, r.country].filter(Boolean).join(', ');
      const coords = Number.isFinite(Number(r.lat)) && Number.isFinite(Number(r.lon))
        ? `${Number(r.lat).toFixed(2)}, ${Number(r.lon).toFixed(2)}` : '';
      return [place, coords].filter(Boolean).join(' · ');
    },
    shortDate(date) {
      return typeof date === 'string' ? date.slice(5) : '';
    },

    // ------------------------------------------------------------------ messages
    sendMessage() {
      const text = (this.message.text || '').trim();
      if (!text) {
        this.$message.warning(this.$t('companion.message.textRequired'));
        return;
      }
      const from = (this.message.from || '').trim();
      try {
        localStorage.setItem(FROM_KEY, from);
      } catch (e) { /* private mode */ }
      this.sendingMessage = true;
      Api.companion.sendCompanionMessage(this.deviceId, { from, text, ask: this.message.ask }, () => {
        this.sendingMessage = false;
        this.message.text = '';
        this.$message.success(this.$t('companion.message.sentOk'));
        this.reloadMessages();
      }, (err) => {
        this.sendingMessage = false;
        this.$message.error(this.errorText(err));
      });
    },
    reloadMessages() {
      Api.companion.getCompanionMessages(this.deviceId, (res) => {
        const data = res.data.data || {};
        if (this.dev && Array.isArray(data.messages)) {
          this.dev = { ...this.dev, messages: data.messages };
        }
      }, () => {});
    },
    statusOf(m) {
      return messageStatus(m);
    },
    statusTagType(m) {
      return { yes: 'success', no: 'danger', seen: 'success', delivered: '', pending: 'warning' }[messageStatus(m)];
    },

    // ------------------------------------------------------------------ commands
    sendCommand(type, arg, okMessage, busyKey) {
      if (this.commandBusy) return;
      this.commandBusy = busyKey || type;
      Api.companion.sendCompanionCommand(this.deviceId, type, arg, (res) => {
        this.commandBusy = '';
        this.$message.success(okMessage || this.$t('companion.action.sent'));
        const cmd = res.data.data;
        if (this.dev && cmd && cmd.id) {
          this.dev = { ...this.dev, commands: [cmd, ...this.commands.filter((c) => c.id !== cmd.id)] };
        }
      }, (err) => {
        this.commandBusy = '';
        this.$message.error(this.errorText(err));
      });
    },
    sendStory() {
      const topic = (this.storyTopic || '').trim();
      this.sendCommand('story', topic, this.$t('companion.action.storySent'));
      this.storyTopic = '';
    },
    commandName(c) {
      const key = 'companion.command.' + c.type;
      const name = this.$te(key) ? this.$t(key) : c.type;
      if (c.type === 'game') return name + ': ' + this.gameName(c.arg);
      return c.arg ? `${name} (${c.arg})` : name;
    },
    gameName(game) {
      const key = 'companion.game.' + game;
      return this.$te(key) ? this.$t(key) : game;
    },

    // ------------------------------------------------------------------ events & formatting
    loadMoreEvents() {
      this.loadingEvents = true;
      Api.companion.getCompanionEvents(this.deviceId, 100, (res) => {
        this.loadingEvents = false;
        const data = res.data.data || {};
        this.moreEvents = Array.isArray(data.events) ? data.events : null;
      }, (err) => {
        this.loadingEvents = false;
        this.$message.error(this.errorText(err));
      });
    },
    eventText(e) {
      const key = 'companion.event.' + e.type;
      let text = this.$te(key) ? this.$t(key) : e.type;
      if (e.type === 'pomodoro_done') text += ' ' + this.$t('companion.event.rounds', { n: e.value });
      else if (e.type === 'game_score') text += ': ' + this.gameName(e.id) + ' ' + e.value;
      else if (e.type === 'streak') text += ': ' + this.$t('companion.event.days', { n: e.value });
      else if (e.id && e.type.indexOf('alarm') === 0) {
        const alarm = this.alarms.find((a) => a.id === e.id);
        if (alarm) text += ' ' + alarm.time;
      } else if (e.id && e.type.indexOf('reminder') === 0) {
        const reminder = this.reminders.find((r) => r.id === e.id);
        if (reminder && reminder.label) text += ': ' + reminder.label;
      }
      return text;
    },
    daysText(mask) {
      const preset = daysPreset(mask);
      if (preset) return this.$t('companion.preset.' + preset);
      return daysOf(mask).map((d) => this.$t('companion.day.' + d)).join(', ');
    },
    ago(ts) {
      const age = ageOf(ts, this.now);
      if (age.unit === 'never') return this.$t('companion.never');
      if (age.unit === 'justNow') return this.$t('companion.justNow');
      return this.$t('companion.ago.' + age.unit, { n: age.value });
    },
    secondsAgoText(seconds) {
      return this.ago(this.now / 1000 - Number(seconds || 0));
    },
    clock(ts) {
      return formatClock(ts);
    },
    clampPercent(value) {
      return Math.max(0, Math.min(100, Number(value) || 0));
    },
    moodEmoji(mood) {
      return MOOD_EMOJI[mood] || '🙂';
    },
  },
};
</script>

<style lang="scss" scoped>
.welcome {
  min-height: 100vh;
  display: flex;
  position: relative;
  flex-direction: column;
  background: #eff4ff;
}

.main-wrapper {
  flex: 1;
  padding: 20px 22px 0;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  min-height: 0;
}

.content-panel {
  display: flex;
  flex: 1;
  border-radius: 15px;
  overflow: hidden;
  border: 1px solid #fff;
}

.content-area {
  flex: 1;
  min-width: 0;
  background-color: white;
  display: flex;
  flex-direction: column;
}

.companion-card {
  border: none;
  flex: 1;

  ::v-deep .el-card__body {
    padding: 14px 20px;
  }
}

.operation-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  padding: 0 0 12px 0;
}

.title-block {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  min-width: 0;
}

.page-title {
  font-weight: 500;
  font-size: 24px;
  margin: 0;
  word-break: break-word;
}

.back-btn {
  border-radius: 8px;
}

.load-error {
  margin-bottom: 12px;
}

.placeholder {
  height: 200px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}

.panel {
  border: 1px solid #ebeef5;
  border-radius: 12px;
  padding: 14px 16px;
  background: #fff;
  min-width: 0;

  h3 {
    margin: 0 0 10px;
    font-size: 16px;
    font-weight: 500;
    color: #303133;
  }

  &.narrow {
    max-width: 560px;
  }
}

.row {
  display: flex;
  align-items: center;
  gap: 10px;

  &.spread {
    justify-content: space-between;
  }

  &.wrap {
    flex-wrap: wrap;
  }
}

.grow {
  flex: 1;
  min-width: 0;
}

.button-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;

  .el-button + .el-button {
    margin-left: 0;
  }
}

.spaced {
  margin-top: 12px;
}

.muted {
  color: #909399;
}

.small {
  font-size: 12px;
}

.big {
  font-size: 18px;
  font-weight: 500;
}

.hint {
  color: #909399;
  font-size: 12px;
  line-height: 1.5;
  margin-top: 4px;
}

.mood {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}

.mood-emoji {
  font-size: 36px;
  line-height: 1;
}

.bond {
  margin-bottom: 12px;

  .row {
    margin-bottom: 4px;
  }
}

.stat-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}

.stat {
  background: #f5f7fa;
  border-radius: 10px;
  padding: 8px;
  text-align: center;

  b {
    display: block;
    font-size: 18px;
    color: #5a64b5;
  }

  span {
    font-size: 12px;
    color: #909399;
  }
}

.facts {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 6px 12px;
  margin: 0;
  font-size: 13px;

  dt {
    color: #909399;
  }

  dd {
    margin: 0;
    word-break: break-word;
  }
}

.score + .score::before {
  content: ' · ';
  color: #c0c4cc;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;

  li {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 0;
    border-bottom: 1px solid #f0f2f5;

    &:last-child {
      border-bottom: none;
    }

    &.disabled .time,
    &.disabled .grow {
      opacity: 0.5;
    }

    .el-button + .el-button {
      margin-left: 0;
    }
  }
}

.clickable {
  cursor: pointer;
}

.time {
  font-size: 20px;
  font-weight: 500;
  min-width: 60px;
  color: #303133;
}

.msg-text {
  white-space: pre-wrap;
  word-break: break-word;
}

.danger-text {
  color: #f56c6c;
}

.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0;
}

.field {
  margin: 8px 0;

  label {
    display: block;
    font-size: 13px;
    color: #606266;
    margin-bottom: 6px;
  }
}

.time-input {
  width: 130px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  column-gap: 16px;
}

.times {
  width: 100%;
  border-collapse: collapse;
  margin-top: 12px;
  font-size: 14px;

  th,
  td {
    padding: 6px 8px;
    text-align: left;
    border-bottom: 1px solid #f0f2f5;
  }

  th {
    color: #909399;
    font-weight: 500;
  }

  tr.next td {
    color: #5a64b5;
    font-weight: 600;
    background: #eff4ff;
  }
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 6px;
}

.chip {
  border: 1px solid #dcdfe6;
  background: #fff;
  color: #606266;
  border-radius: 14px;
  padding: 3px 12px;
  font-size: 13px;
  line-height: 20px;
  cursor: pointer;

  &.on {
    background: #5a64b5;
    border-color: #5a64b5;
    color: #fff;
  }

  &.preset {
    font-size: 12px;
  }

  &:focus-visible {
    outline: 2px solid #409eff;
    outline-offset: 1px;
  }
}

:deep(.el-button--text) {
  color: #7079aa;
}

:deep(.el-button--text:hover) {
  color: #5a64b5;
}

:deep(.el-button--text.danger-text) {
  color: #f56c6c;
}

@media (max-width: 700px) {
  .main-wrapper {
    padding: 10px 8px 0;
  }

  .companion-card ::v-deep .el-card__body {
    padding: 10px 12px;
  }

  .page-title {
    font-size: 20px;
  }

  .grid {
    grid-template-columns: 1fr;
  }

  .companion-tabs ::v-deep .el-tabs__nav-wrap {
    overflow-x: auto;
  }
}
</style>
