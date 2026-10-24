<template>
  <div class="cm">
    <HeaderBar />

    <main class="nx-page cm-page">
      <button type="button" class="nx-back" @click="goBack">
        <i class="el-icon-arrow-left" aria-hidden="true"></i>
        {{ $t('companion.back') }}
      </button>

      <!-- No device in the URL -->
      <section v-if="!deviceId" class="nx-card">
        <div class="nx-empty">
          <span class="nx-icon-tile nx-icon-tile--lg" aria-hidden="true"><i class="el-icon-cpu"></i></span>
          <h1 class="nx-empty__title">{{ tx('companion.noDeviceTitle', 'No robot selected') }}</h1>
          <p class="nx-empty__text">{{ $t('companion.noDevice') }}</p>
          <el-button class="nx-empty__action" type="primary" @click="goBack">{{ $t('companion.back') }}</el-button>
        </div>
      </section>

      <template v-else>
        <!-- Robot header -->
        <header class="cm-hero">
          <span class="cm-hero__avatar" aria-hidden="true">
            <span v-if="dev && stats.mood" class="cm-hero__emoji">{{ moodEmoji(stats.mood) }}</span>
            <i v-else class="el-icon-cpu"></i>
          </span>
          <div class="cm-hero__text">
            <div class="cm-hero__eyebrow">{{ $t('companion.title') }}</div>
            <h1 class="nx-title nx-truncate" :title="dev ? dev.name : ''">
              <template v-if="dev">{{ dev.name || 'TinyBot' }}</template>
              <span v-else class="nx-skeleton cm-sk-title"></span>
            </h1>
            <div v-if="dev" class="cm-hero__chips">
              <span class="nx-badge" :class="dev.online ? 'nx-badge--success' : ''">
                <span class="nx-dot" :class="{ 'nx-dot--online': dev.online }" aria-hidden="true"></span>
                {{ dev.online ? $t('companion.online') : $t('companion.offline') }}
              </span>
              <span class="cm-hero__seen nx-num">{{ $t('companion.lastSeen') }} {{ ago(dev.last_seen) }}</span>
              <span v-if="stats.mood" class="cm-chip" :title="$t('companion.status.state') + ': ' + (stats.state || '-')">
                <span aria-hidden="true">{{ moodEmoji(stats.mood) }}</span> {{ stats.mood }}
              </span>
              <span v-if="stats.bond_score !== undefined" class="cm-chip">
                <i class="el-icon-star-off" aria-hidden="true"></i>
                {{ $t('companion.status.bondLevel', { level: stats.bond_level || 0 }) }}
              </span>
            </div>
          </div>
          <el-tooltip :content="$t('companion.refresh')" placement="bottom" :open-delay="400">
            <button type="button" class="nx-icon-btn cm-hero__refresh" :aria-label="$t('companion.refresh')"
              :disabled="loading" @click="refresh(false)">
              <i :class="loading ? 'el-icon-loading' : 'el-icon-refresh'" aria-hidden="true"></i>
            </button>
          </el-tooltip>
        </header>

        <div v-if="loadError" class="cm-banner" role="alert">
          <i class="el-icon-warning-outline" aria-hidden="true"></i>
          <span class="cm-banner__text">{{ loadError }}</span>
          <el-button size="small" @click="refresh(false)">{{ tx('companion.retry', 'Try again') }}</el-button>
        </div>

        <!-- First load -->
        <div v-if="!dev && !loadError" class="cm-layout" aria-busy="true">
          <div class="cm-nav cm-nav--skeleton">
            <span v-for="n in 6" :key="'n' + n" class="nx-skeleton cm-sk-nav"></span>
          </div>
          <div class="cm-tiles">
            <div v-for="n in 6" :key="'t' + n" class="nx-card cm-tile">
              <span class="nx-skeleton cm-sk-line"></span>
              <span class="nx-skeleton cm-sk-value"></span>
            </div>
          </div>
        </div>

        <div v-if="dev" class="cm-layout">
          <!-- Section list (wide) / segmented scroller (narrow) -->
          <nav class="cm-nav" :aria-label="tx('companion.sections', 'Sections')">
            <button v-for="s in sections" :key="s.key" type="button" class="cm-nav__item"
              :class="{ 'is-active': activeTab === s.key }" :aria-current="activeTab === s.key ? 'page' : null"
              @click="activeTab = s.key">
              <i :class="s.icon" aria-hidden="true"></i>
              <span class="cm-nav__label">{{ $t(s.label) }}</span>
              <span v-if="s.count" class="cm-nav__count nx-num">{{ s.count }}</span>
            </button>
          </nav>

          <div class="cm-content">
            <transition name="nx-fade" mode="out-in">
              <!-- ============================================================ Status -->
              <section v-if="activeTab === 'status'" key="status" class="cm-section">
                <!-- The robot's real screen (self.screen.preview), polled while visible -->
                <article class="nx-card cm-live">
                  <TinyBotLiveScreen :device-id="deviceId" />
                </article>
                <div class="cm-tiles">
                  <div class="nx-card cm-tile">
                    <span class="nx-stat__label">{{ tx('companion.status.mood', 'Mood') }}</span>
                    <span class="nx-stat__value cm-tile__value">
                      <span class="cm-tile__emoji" aria-hidden="true">{{ moodEmoji(stats.mood) }}</span>
                      <span class="nx-truncate">{{ stats.mood || '–' }}</span>
                    </span>
                    <span class="nx-stat__meta nx-truncate">{{ $t('companion.status.state') }}: {{ stats.state || '–' }}</span>
                  </div>
                  <div class="nx-card cm-tile">
                    <span class="nx-stat__label">{{ tx('companion.status.bond', 'Bond') }}</span>
                    <span class="nx-stat__value">
                      {{ stats.bond_score !== undefined ? stats.bond_score : '–' }}<small class="cm-tile__unit">/100</small>
                    </span>
                    <span class="cm-meter" role="progressbar" aria-valuemin="0" aria-valuemax="100"
                      :aria-valuenow="clampPercent(stats.bond_score)">
                      <span class="cm-meter__fill" :style="{ transform: 'scaleX(' + clampPercent(stats.bond_score) / 100 + ')' }"></span>
                    </span>
                    <span class="nx-stat__meta">{{ $t('companion.status.bondLevel', { level: stats.bond_level || 0 }) }}</span>
                  </div>
                  <div class="nx-card cm-tile">
                    <span class="nx-stat__label">{{ $t('companion.status.streak') }}</span>
                    <span class="nx-stat__value">{{ stats.streak || 0 }}</span>
                    <span class="nx-stat__meta">{{ $t('companion.event.days', { n: stats.streak || 0 }) }}</span>
                  </div>
                  <div class="nx-card cm-tile">
                    <span class="nx-stat__label">{{ $t('companion.status.pomodorosToday') }}</span>
                    <span class="nx-stat__value">{{ stats.pomodoros_today || 0 }}</span>
                    <span class="nx-stat__meta">{{ $t('companion.focus.title') }}</span>
                  </div>
                  <div class="nx-card cm-tile">
                    <span class="nx-stat__label">{{ $t('companion.status.volume') }}</span>
                    <span class="nx-stat__value">
                      {{ stats.volume !== undefined ? stats.volume : '–' }}<small v-if="stats.volume !== undefined" class="cm-tile__unit">%</small>
                    </span>
                    <span class="nx-stat__meta">{{ settingsVolumeText }}</span>
                  </div>
                  <div class="nx-card cm-tile">
                    <span class="nx-stat__label">{{ tx('companion.status.wifi', 'Wi-Fi') }}</span>
                    <span class="nx-stat__value">
                      {{ stats.rssi ? stats.rssi : '–' }}<small v-if="stats.rssi" class="cm-tile__unit"> dBm</small>
                    </span>
                    <span class="nx-stat__meta">{{ wifiQuality }}</span>
                  </div>
                </div>

                <div class="cm-grid">
                  <article class="nx-card">
                    <header class="nx-card__header">
                      <h2 class="nx-headline">{{ $t('companion.status.robot') }}</h2>
                    </header>
                    <dl class="nx-kv cm-kv">
                      <dt>{{ $t('companion.status.lastTouch') }}</dt>
                      <dd>{{ stats.last_touch_s !== undefined ? secondsAgoText(stats.last_touch_s) : '–' }}</dd>
                      <dt>{{ $t('companion.status.highScores') }}</dt>
                      <dd>
                        <span v-if="!scores.length">–</span>
                        <span v-for="s in scores" :key="s.game" class="cm-score nx-num">{{ gameName(s.game) }} {{ s.value }}{{ s.ms ? ' ms' : '' }}</span>
                      </dd>
                      <dt>{{ $t('companion.status.firmware') }}</dt>
                      <dd class="nx-mono">{{ stats.fw || '–' }}</dd>
                      <dt>{{ $t('companion.status.ip') }}</dt>
                      <dd class="nx-mono nx-break">{{ stats.ip || '–' }}</dd>
                      <dt>{{ $t('companion.status.rssi') }}</dt>
                      <dd class="nx-num">{{ stats.rssi ? stats.rssi + ' dBm' : '–' }}</dd>
                    </dl>
                  </article>

                  <article class="nx-card">
                    <header class="nx-card__header">
                      <h2 class="nx-headline">{{ $t('companion.status.weather') }}</h2>
                      <span v-if="weather.ok && weather.city" class="nx-caption nx-truncate" :title="weather.city">{{ weather.city }}</span>
                    </header>
                    <template v-if="weather.ok">
                      <div class="cm-weather">
                        <span class="cm-weather__temp nx-num">{{ weather.temp }}°</span>
                        <span class="cm-weather__text">{{ weather.text }}</span>
                      </div>
                      <p class="nx-footnote cm-gap-top">
                        {{ $t('companion.status.weatherDetail', { hi: weather.hi, lo: weather.lo, rain: weather.rain_prob }) }}
                      </p>
                    </template>
                    <p v-else class="nx-footnote">{{ $t('companion.status.noWeather') }}</p>
                    <div v-if="prayer.enabled && upcomingPrayer" class="cm-next-prayer">
                      <span class="nx-icon-tile" aria-hidden="true"><i class="el-icon-sunrise"></i></span>
                      <div>
                        <div class="nx-caption">{{ $t('companion.status.nextPrayer') }}</div>
                        <div class="cm-next-prayer__value nx-num">
                          {{ $t('companion.prayer.' + upcomingPrayer.key) }} · {{ upcomingPrayer.time }}
                          <span v-if="upcomingPrayer.tomorrow" class="nx-caption">({{ $t('companion.prayer.tomorrow') }})</span>
                        </div>
                      </div>
                    </div>
                  </article>
                </div>

                <article class="nx-card cm-gap-top-lg">
                  <header class="nx-card__header">
                    <h2 class="nx-headline">{{ $t('companion.status.events') }}</h2>
                    <el-button size="small" :loading="loadingEvents" @click="loadMoreEvents">{{ $t('companion.status.moreEvents') }}</el-button>
                  </header>
                  <div v-if="!eventList.length" class="nx-empty cm-empty-sm">
                    <span class="nx-icon-tile nx-icon-tile--neutral" aria-hidden="true"><i class="el-icon-time"></i></span>
                    <p class="nx-empty__text">{{ $t('companion.status.noEvents') }}</p>
                  </div>
                  <ol v-else class="cm-timeline">
                    <li v-for="(e, i) in eventList" :key="i + '-' + (e.rx || e.ts)" class="cm-timeline__item"
                      :class="'is-' + eventVisual(e).tone">
                      <span class="cm-timeline__icon" aria-hidden="true"><i :class="eventVisual(e).icon"></i></span>
                      <span class="cm-timeline__text">{{ eventText(e) }}</span>
                      <span class="cm-timeline__time nx-num">{{ ago(e.rx || e.ts) }}</span>
                    </li>
                  </ol>
                </article>
              </section>

              <!-- ============================================================ Alarms -->
              <section v-else-if="activeTab === 'alarms'" key="alarms" class="cm-section">
                <article class="nx-card nx-card--flush">
                  <header class="cm-card-head">
                    <div>
                      <h2 class="nx-headline">{{ $t('companion.tab.alarms') }}</h2>
                      <p class="nx-caption nx-num">{{ tx('companion.countOf', '{n} of {max}', { n: alarms.length, max: maxAlarms }) }}</p>
                    </div>
                    <el-button type="primary" icon="el-icon-plus" :disabled="alarms.length >= maxAlarms"
                      @click="openAlarm(null)">{{ $t('companion.alarm.add') }}</el-button>
                  </header>
                  <div v-if="!alarms.length" class="nx-empty">
                    <span class="nx-icon-tile nx-icon-tile--lg" aria-hidden="true"><i class="el-icon-alarm-clock"></i></span>
                    <h3 class="nx-empty__title">{{ $t('companion.alarm.none') }}</h3>
                    <p class="nx-empty__text">{{ tx('companion.alarm.emptyText', 'Add an alarm and TinyBot wakes the family with a friendly voice.') }}</p>
                  </div>
                  <ul v-else class="cm-rows">
                    <li v-for="a in sortedAlarms" :key="a.id" class="cm-alarm" :class="{ 'is-off': !a.enabled }">
                      <button type="button" class="cm-alarm__main" @click="openAlarm(a)">
                        <span class="cm-alarm__time nx-num">{{ a.time }}</span>
                        <span class="cm-alarm__body">
                          <span class="cm-alarm__label nx-truncate">{{ a.label || $t('companion.alarm.defaultLabel') }}</span>
                          <span class="cm-days">
                            <template v-if="dayPresetKey(a.days)">
                              <span class="cm-day is-on">{{ $t('companion.preset.' + dayPresetKey(a.days)) }}</span>
                            </template>
                            <template v-else>
                              <span v-for="d in dayList(a.days)" :key="d" class="cm-day is-on">{{ $t('companion.day.' + d) }}</span>
                            </template>
                            <span v-if="a.snooze_min" class="cm-alarm__meta">{{ $t('companion.alarm.snoozeShort', { min: a.snooze_min }) }}</span>
                          </span>
                          <span v-if="a.say" class="cm-alarm__say nx-truncate" :title="a.say">
                            <i class="el-icon-microphone" aria-hidden="true"></i> {{ a.say }}
                          </span>
                        </span>
                      </button>
                      <div class="cm-row-actions">
                        <el-switch :value="a.enabled" :disabled="saving.alarms" :aria-label="$t('companion.enabled')"
                          @change="(v) => toggleAlarm(a, v)" />
                        <button type="button" class="nx-icon-btn" :aria-label="$t('common.edit')" @click="openAlarm(a)">
                          <i class="el-icon-edit" aria-hidden="true"></i>
                        </button>
                        <button type="button" class="nx-icon-btn nx-icon-btn--danger" :aria-label="$t('common.delete')" @click="deleteAlarm(a)">
                          <i class="el-icon-delete" aria-hidden="true"></i>
                        </button>
                      </div>
                    </li>
                  </ul>
                </article>
              </section>

              <!-- ============================================================ Reminders -->
              <section v-else-if="activeTab === 'reminders'" key="reminders" class="cm-section">
                <article class="nx-card nx-card--flush">
                  <header class="cm-card-head">
                    <div>
                      <h2 class="nx-headline">{{ $t('companion.tab.reminders') }}</h2>
                      <p class="nx-caption nx-num">{{ tx('companion.countOf', '{n} of {max}', { n: reminders.length, max: maxReminders }) }}</p>
                    </div>
                    <el-dropdown trigger="click" placement="bottom-end" :disabled="reminders.length >= maxReminders"
                      @command="(kind) => openReminder(null, kind)">
                      <el-button type="primary" icon="el-icon-plus" :disabled="reminders.length >= maxReminders">
                        {{ $t('companion.reminder.add') }} <i class="el-icon-arrow-down el-icon--right" aria-hidden="true"></i>
                      </el-button>
                      <el-dropdown-menu slot="dropdown">
                        <el-dropdown-item v-for="kind in reminderKinds" :key="kind" :command="kind" :icon="kindIcon(kind)">
                          {{ $t('companion.reminder.kind.' + kind) }}
                        </el-dropdown-item>
                      </el-dropdown-menu>
                    </el-dropdown>
                  </header>
                  <div v-if="!reminders.length" class="nx-empty">
                    <span class="nx-icon-tile nx-icon-tile--lg" aria-hidden="true"><i class="el-icon-bell"></i></span>
                    <h3 class="nx-empty__title">{{ $t('companion.reminder.none') }}</h3>
                    <p class="nx-empty__text">{{ tx('companion.reminder.emptyText', 'Water, medicine or anything else: TinyBot reminds you at the right time.') }}</p>
                  </div>
                  <template v-else>
                  <div v-for="group in reminderGroups" :key="group.kind" class="cm-group">
                    <h3 class="cm-group__title">
                      <span class="nx-icon-tile cm-kind" :class="'cm-kind--' + group.kind" aria-hidden="true"><i :class="kindIcon(group.kind)"></i></span>
                      {{ $t('companion.reminder.kind.' + group.kind) }}
                      <span class="nx-caption nx-num">{{ group.items.length }}</span>
                    </h3>
                    <ul class="cm-rows">
                      <li v-for="r in group.items" :key="r.id" class="cm-reminder" :class="{ 'is-off': !r.enabled }">
                        <button type="button" class="cm-reminder__main" @click="openReminder(r)">
                          <span class="cm-reminder__label nx-truncate">{{ r.label }}</span>
                          <span class="cm-reminder__when nx-num">{{ reminderWhen(r) }}</span>
                          <span v-if="r.say" class="cm-alarm__say nx-truncate" :title="r.say">
                            <i class="el-icon-microphone" aria-hidden="true"></i> {{ r.say }}
                          </span>
                        </button>
                        <div class="cm-row-actions">
                          <el-switch :value="r.enabled" :disabled="saving.reminders" :aria-label="$t('companion.enabled')"
                            @change="(v) => toggleReminder(r, v)" />
                          <button type="button" class="nx-icon-btn" :aria-label="$t('common.edit')" @click="openReminder(r)">
                            <i class="el-icon-edit" aria-hidden="true"></i>
                          </button>
                          <button type="button" class="nx-icon-btn nx-icon-btn--danger" :aria-label="$t('common.delete')" @click="deleteReminder(r)">
                            <i class="el-icon-delete" aria-hidden="true"></i>
                          </button>
                        </div>
                      </li>
                    </ul>
                  </div>
                  </template>
                </article>
              </section>

              <!-- ============================================================ Prayer -->
              <section v-else-if="activeTab === 'prayer'" key="prayer" class="cm-section cm-grid">
                <article class="nx-card">
                  <header class="nx-card__header">
                    <h2 class="nx-headline">{{ $t('companion.tab.prayer') }}</h2>
                    <span v-if="prayerDays.length" class="nx-caption nx-num">
                      {{ $t('companion.prayer.today') }} {{ shortDate(prayerDays[0].date) }}
                    </span>
                  </header>
                  <div class="cm-settings">
                    <div class="cm-setting">
                      <span>{{ $t('companion.prayer.enable') }}</span>
                      <el-switch :value="!!prayer.enabled" :disabled="saving.prayer" :aria-label="$t('companion.prayer.enable')"
                        @change="(v) => savePrayer({ enabled: v })" />
                    </div>
                    <div class="cm-setting">
                      <span>{{ $t('companion.prayer.remind') }}</span>
                      <el-switch :value="!!prayer.remind" :disabled="saving.prayer" :aria-label="$t('companion.prayer.remind')"
                        @change="(v) => savePrayer({ remind: v })" />
                    </div>
                  </div>
                  <p class="nx-footnote cm-gap-top nx-break">
                    {{ $t('companion.prayer.city') }}: <strong>{{ prayer.city || '–' }}</strong>
                    · {{ $t('companion.prayer.weatherCity') }}: <strong>{{ weather.city || '–' }}</strong>
                  </p>

                  <template v-if="prayer.enabled && prayerDays.length">
                    <div class="cm-prayer cm-prayer--head" aria-hidden="true">
                      <span></span>
                      <span class="cm-prayer__col">{{ $t('companion.prayer.today') }}</span>
                      <span v-if="prayerDays[1]" class="cm-prayer__col">{{ $t('companion.prayer.tomorrow') }}</span>
                    </div>
                    <ul class="cm-prayers">
                      <li v-for="k in prayerRows" :key="k" class="cm-prayer" :class="{ 'is-next': isNextPrayer(k) }">
                        <span class="cm-prayer__name">
                          {{ $t('companion.prayer.' + k) }}
                          <span v-if="isNextPrayer(k)" class="nx-badge nx-badge--accent">{{ tx('companion.prayer.next', 'Next') }}</span>
                        </span>
                        <span class="cm-prayer__time nx-num">{{ prayerDays[0][k] || '–' }}</span>
                        <span v-if="prayerDays[1]" class="cm-prayer__tomorrow nx-num"
                          :title="$t('companion.prayer.tomorrow') + ' ' + shortDate(prayerDays[1].date)">
                          {{ prayerDays[1][k] || '–' }}
                        </span>
                      </li>
                    </ul>
                    <p class="nx-caption cm-gap-top">{{ $t('companion.prayer.methodHint') }}</p>
                  </template>
                  <p v-else-if="prayer.enabled" class="nx-footnote cm-gap-top">{{ $t('companion.prayer.noTimes') }}</p>
                </article>

                <article class="nx-card">
                  <header class="nx-card__header">
                    <h2 class="nx-headline">{{ $t('companion.prayer.changeCity') }}</h2>
                  </header>
                  <div class="cm-inline-form">
                    <el-input v-model="cityQuery" clearable prefix-icon="el-icon-location-outline"
                      :placeholder="$t('companion.prayer.cityPlaceholder')" :aria-label="$t('companion.prayer.changeCity')"
                      @keyup.enter.native="searchCity" />
                    <el-button :loading="citySearching" @click="searchCity">{{ $t('companion.prayer.search') }}</el-button>
                  </div>
                  <el-checkbox v-model="citySameWeather" class="cm-gap-top">{{ $t('companion.prayer.sameForWeather') }}</el-checkbox>
                  <p v-if="citySearched && !cityResults.length && !citySearching" class="nx-footnote cm-gap-top">
                    {{ $t('companion.prayer.noResults') }}
                  </p>
                  <ul v-if="cityResults.length" class="cm-cities">
                    <li v-for="(r, i) in cityResults" :key="i">
                      <button type="button" class="cm-city" :disabled="saving.prayer" @click="chooseCity(r)">
                        <span class="cm-city__text">
                          <span class="cm-city__name nx-truncate">{{ r.name }}</span>
                          <span class="nx-caption nx-truncate">{{ cityDetail(r) }}</span>
                        </span>
                        <i class="el-icon-arrow-right" aria-hidden="true"></i>
                      </button>
                    </li>
                  </ul>
                </article>
              </section>

              <!-- ============================================================ Focus -->
              <section v-else-if="activeTab === 'focus'" key="focus" class="cm-section">
                <article class="nx-card cm-form-card">
                  <header class="nx-card__header">
                    <h2 class="nx-headline">{{ $t('companion.focus.title') }}</h2>
                    <span class="nx-badge nx-badge--success nx-num">
                      {{ stats.pomodoros_today || 0 }} · {{ $t('companion.status.pomodorosToday') }}
                    </span>
                  </header>
                  <el-form label-position="top" class="cm-fields">
                    <el-form-item :label="$t('companion.focus.work')">
                      <el-input-number v-model="forms.pomodoro.work_min" :min="1" :max="120" controls-position="right" />
                    </el-form-item>
                    <el-form-item :label="$t('companion.focus.rounds')">
                      <el-input-number v-model="forms.pomodoro.rounds" :min="1" :max="12" controls-position="right" />
                    </el-form-item>
                    <el-form-item :label="$t('companion.focus.shortBreak')">
                      <el-input-number v-model="forms.pomodoro.short_break_min" :min="1" :max="60" controls-position="right" />
                    </el-form-item>
                    <el-form-item :label="$t('companion.focus.longBreak')">
                      <el-input-number v-model="forms.pomodoro.long_break_min" :min="1" :max="90" controls-position="right" />
                    </el-form-item>
                  </el-form>
                  <p class="nx-footnote">
                    {{ $t('companion.focus.hint', { rounds: forms.pomodoro.rounds, done: stats.pomodoros_today || 0 }) }}
                  </p>
                  <footer class="nx-card__footer">
                    <span v-if="isDirty('pomodoro')" class="cm-unsaved">{{ tx('companion.unsaved', 'Unsaved changes') }}</span>
                    <el-button v-if="isDirty('pomodoro')" type="text" @click="revertSection('pomodoro')">{{ tx('companion.revert', 'Undo changes') }}</el-button>
                    <el-button :disabled="!isDirty('pomodoro')" :loading="saving.pomodoro"
                      @click="saveSection('pomodoro')">{{ $t('companion.save') }}</el-button>
                    <el-button type="primary" icon="el-icon-video-play" :loading="commandBusy === 'pomodoro'"
                      @click="sendCommand('pomodoro', forms.pomodoro.work_min, $t('companion.focus.started'))">
                      {{ $t('companion.focus.startNow') }}
                    </el-button>
                  </footer>
                </article>
              </section>

              <!-- ============================================================ Messages -->
              <section v-else-if="activeTab === 'messages'" key="messages" class="cm-section cm-grid cm-grid--messages">
                <article class="nx-card cm-composer">
                  <header class="nx-card__header">
                    <h2 class="nx-headline">{{ $t('companion.message.send') }}</h2>
                  </header>
                  <el-form label-position="top" @submit.native.prevent>
                    <el-form-item :label="$t('companion.message.from')">
                      <el-input v-model="message.from" :maxlength="maxName" placeholder="Ammu" />
                      <div class="cm-help">{{ $t('companion.message.fromHint') }}</div>
                    </el-form-item>
                    <el-form-item :label="$t('companion.message.text')">
                      <el-input v-model="message.text" type="textarea" :autosize="{ minRows: 3, maxRows: 8 }" :maxlength="maxMessage"
                        show-word-limit :placeholder="$t('companion.message.textPlaceholder')" />
                      <div class="cm-help">{{ $t('companion.message.textHint') }}</div>
                    </el-form-item>
                  </el-form>
                  <footer class="cm-composer__bar">
                    <label class="cm-composer__ask">
                      <el-switch v-model="message.ask" :aria-label="$t('companion.message.ask')" />
                      <span>{{ $t('companion.message.ask') }}</span>
                    </label>
                    <el-button type="primary" icon="el-icon-s-promotion" :loading="sendingMessage"
                      @click="sendMessage">{{ $t('companion.message.sendButton') }}</el-button>
                  </footer>
                </article>

                <article class="nx-card">
                  <header class="nx-card__header">
                    <h2 class="nx-headline">{{ $t('companion.message.sent') }}</h2>
                    <span v-if="messages.length" class="nx-caption nx-num">{{ messages.length }}</span>
                  </header>
                  <div v-if="!messages.length" class="nx-empty cm-empty-sm">
                    <span class="nx-icon-tile nx-icon-tile--neutral" aria-hidden="true"><i class="el-icon-chat-line-round"></i></span>
                    <p class="nx-empty__text">{{ $t('companion.message.none') }}</p>
                  </div>
                  <ul v-else class="cm-thread">
                    <li v-for="m in messages" :key="m.id" class="cm-bubble-row">
                      <div class="cm-bubble">
                        <p class="cm-bubble__text">{{ m.text }}</p>
                        <div class="cm-bubble__meta">
                          <span class="nx-truncate">
                            <span v-if="m.from">{{ m.from }} · </span><span class="nx-num">{{ clock(m.ts) }}</span>
                            <span v-if="m.ask"> · {{ $t('companion.message.askShort') }}</span>
                          </span>
                          <span class="nx-badge" :class="'nx-badge--' + statusBadge(m)">
                            {{ $t('companion.message.status.' + statusOf(m)) }}
                          </span>
                        </div>
                      </div>
                    </li>
                  </ul>
                </article>
              </section>

              <!-- ============================================================ TinyBot's day -->
              <section v-else-if="activeTab === 'day'" key="day" class="cm-section cm-grid cm-grid--day">
                <article class="nx-card nx-card--flush">
                  <header class="cm-card-head">
                    <div class="cm-min">
                      <h2 class="nx-headline">{{ $t('companion.routine.title') }}</h2>
                      <p class="nx-caption nx-num">{{ tx('companion.countOf', '{n} of {max}', { n: forms.routine.items.length, max: maxRoutine }) }}</p>
                    </div>
                    <el-button type="primary" icon="el-icon-plus" :disabled="forms.routine.items.length >= maxRoutine"
                      @click="openDayItem(-1)">{{ $t('companion.routine.add') }}</el-button>
                  </header>
                  <div class="cm-day-intro">
                    <p class="cm-help">{{ $t('companion.routine.desc') }}</p>
                    <div class="cm-settings">
                      <div class="cm-setting">
                        <span class="cm-setting__text">
                          <span>{{ $t('companion.routine.enabled') }}</span>
                          <span v-if="!forms.routine.enabled" class="cm-help">{{ $t('companion.routine.offNote') }}</span>
                        </span>
                        <el-switch v-model="forms.routine.enabled" :aria-label="$t('companion.routine.enabled')" />
                      </div>
                    </div>
                  </div>
                  <div v-if="!forms.routine.items.length" class="nx-empty cm-empty-sm">
                    <span class="nx-icon-tile nx-icon-tile--lg" aria-hidden="true"><i class="el-icon-coffee-cup"></i></span>
                    <h3 class="nx-empty__title">{{ $t('companion.routine.empty') }}</h3>
                    <p class="nx-empty__text">{{ $t('companion.routine.emptyText') }}</p>
                  </div>
                  <ul v-else class="cm-rows" :class="{ 'is-off': !forms.routine.enabled }">
                    <li v-for="(item, i) in forms.routine.items" :key="i + '-' + item.start + '-' + item.activity"
                      class="cm-alarm cm-day-row" :class="{ 'is-now': i === dayNowIndex, 'is-shown': item.activity === previewActivity }">
                      <button type="button" class="cm-alarm__main cm-day-row__main" :aria-pressed="item.activity === previewActivity ? 'true' : 'false'"
                        :title="$t('companion.routine.showPreview')" @click="dayPreview = item.activity">
                        <span class="cm-day-row__time nx-num">
                          {{ item.start }}<span class="cm-day-row__dash" aria-hidden="true">–</span>{{ item.end }}
                        </span>
                        <span class="cm-day-row__icon" aria-hidden="true">{{ activityIcons[item.activity] }}</span>
                        <span class="cm-alarm__body">
                          <span class="cm-alarm__label nx-truncate">{{ activityName(item.activity) }}</span>
                          <span class="cm-alarm__meta">
                            {{ durationText(item) }}
                            <span v-if="dayOverlapRows[i]" class="cm-day-row__warn">· {{ $t('companion.routine.overlapShort') }}</span>
                          </span>
                        </span>
                        <span v-if="i === dayNowIndex && forms.routine.enabled" class="nx-badge nx-badge--success">{{ $t('companion.routine.now') }}</span>
                      </button>
                      <div class="cm-row-actions">
                        <button type="button" class="nx-icon-btn" :aria-label="$t('companion.routine.edit')" @click="openDayItem(i)">
                          <i class="el-icon-edit" aria-hidden="true"></i>
                        </button>
                        <button type="button" class="nx-icon-btn nx-icon-btn--danger" :aria-label="$t('companion.routine.remove')" @click="removeDayItem(i)">
                          <i class="el-icon-delete" aria-hidden="true"></i>
                        </button>
                      </div>
                    </li>
                  </ul>
                  <div class="cm-day-notes">
                    <div v-for="pair in dayOverlaps" :key="'o' + pair[0] + '-' + pair[1]" class="cm-banner cm-banner--warning" role="status">
                      <i class="el-icon-warning-outline" aria-hidden="true"></i>
                      <span class="cm-banner__text">{{ overlapText(pair) }}</span>
                    </div>
                    <p class="nx-footnote">{{ $t('companion.routine.note') }}</p>
                    <p class="nx-footnote">{{ $t('companion.routine.voiceNote') }}</p>
                  </div>
                  <footer class="nx-card__footer cm-day-foot">
                    <el-button type="text" icon="el-icon-refresh-left" class="cm-day-foot__reset" :disabled="isDefaultDay"
                      @click="resetDay">{{ $t('companion.routine.reset') }}</el-button>
                    <span v-if="isDirty('routine')" class="cm-unsaved">{{ tx('companion.unsaved', 'Unsaved changes') }}</span>
                    <el-button v-if="isDirty('routine')" type="text" @click="revertSection('routine')">{{ tx('companion.revert', 'Undo changes') }}</el-button>
                    <el-button type="primary" :disabled="!isDirty('routine')" :loading="saving.routine"
                      @click="saveSection('routine')">{{ $t('companion.save') }}</el-button>
                  </footer>
                </article>

                <article class="nx-card cm-day-preview">
                  <header class="nx-card__header">
                    <h2 class="nx-headline">{{ $t('companion.routine.previewTitle') }}</h2>
                  </header>
                  <p v-if="stats.activity" class="cm-chip cm-day-now" role="status">
                    <span aria-hidden="true">{{ activityIcons[stats.activity] || '•' }}</span>
                    {{ $t('companion.routine.nowDoing', { activity: activityName(stats.activity) }) }}
                  </p>
                  <p class="cm-help cm-day-scheduled">{{ dayScheduledText }}</p>
                  <TinyBotDayPreview :value="previewActivity" :look="dev.settings && dev.settings.look"
                    :now-activity="dayNowActivity" @input="(a) => dayPreview = a" />
                </article>
              </section>

              <!-- ============================================================ Night & care -->
              <section v-else-if="activeTab === 'night'" key="night" class="cm-section cm-grid">
                <article class="nx-card">
                  <header class="nx-card__header">
                    <h2 class="nx-headline">{{ $t('companion.night.title') }}</h2>
                  </header>
                  <div class="cm-times">
                    <label class="cm-field">
                      <span class="cm-field__label">{{ $t('companion.night.start') }}</span>
                      <el-time-picker v-model="forms.night.start" value-format="HH:mm" format="HH:mm"
                        :clearable="false" class="cm-time-input" />
                    </label>
                    <i class="el-icon-right cm-times__arrow" aria-hidden="true"></i>
                    <label class="cm-field">
                      <span class="cm-field__label">{{ $t('companion.night.end') }}</span>
                      <el-time-picker v-model="forms.night.end" value-format="HH:mm" format="HH:mm"
                        :clearable="false" class="cm-time-input" />
                    </label>
                  </div>
                  <div class="cm-settings cm-gap-top">
                    <div class="cm-setting">
                      <span>{{ $t('companion.night.enabled') }}</span>
                      <el-switch v-model="forms.night.enabled" :aria-label="$t('companion.night.enabled')" />
                    </div>
                    <div class="cm-setting">
                      <span>{{ $t('companion.night.dim') }}</span>
                      <el-switch v-model="forms.night.dim" :aria-label="$t('companion.night.dim')" />
                    </div>
                    <div class="cm-setting">
                      <span>{{ $t('companion.night.lullaby') }}</span>
                      <el-switch v-model="forms.night.lullaby" :aria-label="$t('companion.night.lullaby')" />
                    </div>
                    <div class="cm-setting">
                      <span>{{ $t('companion.night.light') }}</span>
                      <el-switch v-model="forms.night.light" :aria-label="$t('companion.night.light')" />
                    </div>
                  </div>
                  <div class="cm-minutes cm-gap-top">
                    <label class="cm-field">
                      <span class="cm-field__label">{{ tx('companion.night.lightFor', 'Night light stays on') }}</span>
                      <el-select :value="pickerChoice('light')" class="cm-minutes__select"
                        :aria-label="tx('companion.night.lightFor', 'Night light stays on')" @change="(v) => pickMinutes('light', v)">
                        <el-option v-for="n in minutePickers.light.presets" :key="n" :value="n"
                          :label="minutesLabel(n, 'companion.night.lightUntilMorning', 'Until morning')" />
                        <el-option value="custom" :label="tx('companion.minutesCustom', 'Custom…')" />
                      </el-select>
                    </label>
                    <label v-if="pickerChoice('light') === 'custom'" class="cm-field">
                      <span class="cm-field__label">{{ tx('companion.minutesRange', 'Minutes (0–{max})', { max: minutePickers.light.max }) }}</span>
                      <el-input-number v-model="forms.night.light_minutes" :min="0" :max="minutePickers.light.max" :step="5"
                        :precision="0" controls-position="right" />
                    </label>
                  </div>
                  <p class="cm-help">{{ tx('companion.night.lightForHint', 'Until morning: the light stays on until night mode ends (1 hour when you turn it on by hand). Otherwise it turns itself off after this time.') }}</p>
                  <div class="cm-button-row cm-gap-top">
                    <el-button icon="el-icon-moon" :disabled="!!commandBusy && commandBusy !== 'night:on'"
                      :loading="commandBusy === 'night:on'"
                      @click="sendCommand('night', 'on', $t('companion.night.startedNow'), 'night:on')">
                      {{ $t('companion.night.startNow') }}
                    </el-button>
                    <el-button icon="el-icon-sunny" :disabled="!!commandBusy && commandBusy !== 'night:off'"
                      :loading="commandBusy === 'night:off'"
                      @click="sendCommand('night', 'off', $t('companion.night.endedNow'), 'night:off')">
                      {{ $t('companion.night.endNow') }}
                    </el-button>
                  </div>
                  <p class="cm-help">{{ $t('companion.night.nowHint') }}</p>
                  <footer class="nx-card__footer">
                    <span v-if="isDirty('night')" class="cm-unsaved">{{ tx('companion.unsaved', 'Unsaved changes') }}</span>
                    <el-button v-if="isDirty('night')" type="text" @click="revertSection('night')">{{ tx('companion.revert', 'Undo changes') }}</el-button>
                    <el-button type="primary" :disabled="!isDirty('night')" :loading="saving.night"
                      @click="saveSection('night')">{{ $t('companion.save') }}</el-button>
                  </footer>
                </article>

                <article class="nx-card">
                  <header class="nx-card__header">
                    <h2 class="nx-headline">{{ $t('companion.care.title') }}</h2>
                  </header>
                  <div class="cm-settings">
                    <div class="cm-setting">
                      <span>{{ $t('companion.care.enabled') }}</span>
                      <el-switch v-model="forms.care.enabled" :aria-label="$t('companion.care.enabled')" />
                    </div>
                  </div>
                  <label class="cm-field cm-gap-top">
                    <span class="cm-field__label">{{ $t('companion.care.lonelyAfter') }}</span>
                    <el-input-number v-model="forms.care.lonely_after_min" :min="10" :max="1440" :step="10" controls-position="right" />
                  </label>
                  <p class="nx-footnote cm-gap-top">{{ $t('companion.care.hint') }}</p>
                  <footer class="nx-card__footer">
                    <span v-if="isDirty('care')" class="cm-unsaved">{{ tx('companion.unsaved', 'Unsaved changes') }}</span>
                    <el-button v-if="isDirty('care')" type="text" @click="revertSection('care')">{{ tx('companion.revert', 'Undo changes') }}</el-button>
                    <el-button type="primary" :disabled="!isDirty('care')" :loading="saving.care"
                      @click="saveSection('care')">{{ $t('companion.save') }}</el-button>
                  </footer>
                </article>
              </section>

              <!-- ============================================================ Sound & robot -->
              <section v-else-if="activeTab === 'sound'" key="sound" class="cm-section cm-grid">
                <article class="nx-card">
                  <header class="nx-card__header">
                    <h2 class="nx-headline">{{ $t('companion.sound.title') }}</h2>
                  </header>
                  <div class="cm-settings">
                    <div class="cm-setting">
                      <span>{{ $t('companion.sound.controlVolume') }}</span>
                      <el-switch v-model="forms.sound.controlVolume" :aria-label="$t('companion.sound.controlVolume')" />
                    </div>
                  </div>
                  <div class="cm-volume" :class="{ 'is-disabled': !forms.sound.controlVolume }">
                    <div class="cm-volume__head">
                      <span class="cm-field__label">{{ $t('companion.sound.volume') }}</span>
                      <span class="cm-volume__now nx-num" aria-live="polite">{{ robotVolumeText }}</span>
                      <span v-if="forms.sound.controlVolume" class="cm-volume__value nx-num">{{ forms.sound.volume }}%</span>
                    </div>
                    <div class="cm-volume__slider">
                      <i class="el-icon-minus" aria-hidden="true"></i>
                      <el-slider v-model="forms.sound.volume" :min="0" :max="100" :step="5" :show-tooltip="false"
                        :disabled="!forms.sound.controlVolume" :aria-label="$t('companion.sound.volume')" />
                      <i class="el-icon-plus" aria-hidden="true"></i>
                    </div>
                    <p v-if="!forms.sound.controlVolume" class="cm-help">{{ $t('companion.sound.autoHint') }}</p>
                  </div>
                  <div class="cm-settings cm-gap-top">
                    <div class="cm-setting">
                      <span>{{ $t('companion.sound.sounds') }}</span>
                      <el-switch v-model="forms.sound.sounds" :aria-label="$t('companion.sound.sounds')" />
                    </div>
                  </div>
                  <footer class="nx-card__footer">
                    <span v-if="isDirty('sound')" class="cm-unsaved">{{ tx('companion.unsaved', 'Unsaved changes') }}</span>
                    <el-button v-if="isDirty('sound')" type="text" @click="revertSection('sound')">{{ tx('companion.revert', 'Undo changes') }}</el-button>
                    <el-button type="primary" :disabled="!isDirty('sound')" :loading="saving.sound"
                      @click="saveSection('sound')">{{ $t('companion.save') }}</el-button>
                  </footer>
                </article>

                <article class="nx-card">
                  <header class="nx-card__header">
                    <h2 class="nx-headline">{{ tx('companion.display.title', 'Display') }}</h2>
                  </header>
                  <div v-for="key in ['dim', 'off']" :key="key" class="cm-minutes" :class="{ 'cm-gap-top': key === 'off' }">
                    <label class="cm-field">
                      <span class="cm-field__label">{{ key === 'dim'
                        ? tx('companion.display.dimAfter', 'Dim the screen after')
                        : tx('companion.display.offAfter', 'Turn the screen off after') }}</span>
                      <el-select :value="pickerChoice(key)" class="cm-minutes__select"
                        :aria-label="key === 'dim' ? tx('companion.display.dimAfter', 'Dim the screen after') : tx('companion.display.offAfter', 'Turn the screen off after')"
                        @change="(v) => pickMinutes(key, v)">
                        <el-option v-for="n in minutePickers[key].presets" :key="n" :value="n"
                          :label="minutesLabel(n, 'companion.display.never', 'Never')" />
                        <el-option value="custom" :label="tx('companion.minutesCustom', 'Custom…')" />
                      </el-select>
                    </label>
                    <label v-if="pickerChoice(key) === 'custom'" class="cm-field">
                      <span class="cm-field__label">{{ tx('companion.minutesRange', 'Minutes (0–{max})', { max: minutePickers[key].max }) }}</span>
                      <el-input-number v-model="forms.display[minutePickers[key].field]" :min="0" :max="minutePickers[key].max"
                        :precision="0" controls-position="right" />
                    </label>
                  </div>
                  <p class="cm-help cm-gap-top">{{ tx('companion.display.hint', 'Minutes without touch or talk. Touching TinyBot or talking to it wakes the screen up again. Dimming protects the OLED from burn-in.') }}</p>
                  <footer class="nx-card__footer">
                    <span v-if="isDirty('display')" class="cm-unsaved">{{ tx('companion.unsaved', 'Unsaved changes') }}</span>
                    <el-button v-if="isDirty('display')" type="text" @click="revertSection('display')">{{ tx('companion.revert', 'Undo changes') }}</el-button>
                    <el-button type="primary" :disabled="!isDirty('display')" :loading="saving.display"
                      @click="saveSection('display')">{{ $t('companion.save') }}</el-button>
                  </footer>
                </article>

                <article class="nx-card">
                  <header class="nx-card__header">
                    <h2 class="nx-headline">{{ $t('companion.robot.title') }}</h2>
                  </header>
                  <el-form label-position="top" @submit.native.prevent>
                    <el-form-item :label="$t('companion.robot.name')">
                      <el-input v-model="forms.robot.name" :maxlength="maxName" show-word-limit />
                    </el-form-item>
                    <el-form-item :label="$t('companion.robot.ownerName')">
                      <el-input v-model="forms.robot.owner_name" :maxlength="maxName" show-word-limit />
                      <div class="cm-help">{{ $t('companion.robot.ownerHint', sayTokens) }}</div>
                    </el-form-item>
                  </el-form>
                  <p class="nx-caption">ID <span class="nx-mono nx-break">{{ dev.id }}</span></p>
                  <footer class="nx-card__footer">
                    <span v-if="isDirty('robot')" class="cm-unsaved">{{ tx('companion.unsaved', 'Unsaved changes') }}</span>
                    <el-button v-if="isDirty('robot')" type="text" @click="revertSection('robot')">{{ tx('companion.revert', 'Undo changes') }}</el-button>
                    <el-button type="primary" :disabled="!isDirty('robot')" :loading="saving.robot"
                      @click="saveSection('robot')">{{ $t('companion.save') }}</el-button>
                  </footer>
                </article>

                <article class="nx-card">
                  <header class="nx-card__header">
                    <h2 class="nx-headline">{{ $t('companion.pages.title') }}</h2>
                  </header>
                  <div class="cm-settings">
                    <div v-for="p in robotPageKeys" :key="p" class="cm-setting">
                      <span class="cm-setting__text">
                        <span>{{ $t('companion.pages.' + p) }}</span>
                        <span class="cm-help">{{ $t('companion.pages.' + p + 'Hint') }}</span>
                        <span v-if="isLastPageOn(pages, p)" class="cm-help">{{ $t('companion.pages.lastOn') }}</span>
                      </span>
                      <el-switch :value="pages[p]" :disabled="saving.pages || isLastPageOn(pages, p)"
                        :aria-label="$t('companion.pages.' + p)" @change="(v) => setPage(p, v)" />
                    </div>
                  </div>
                  <p class="nx-footnote cm-gap-top">{{ $t('companion.pages.footer') }}</p>
                </article>
              </section>

              <!-- ============================================================ Quick actions -->
              <section v-else-if="activeTab === 'actions'" key="actions" class="cm-section">
                <div v-if="!dev.online" class="cm-banner cm-banner--info" role="status">
                  <i class="el-icon-info" aria-hidden="true"></i>
                  <span class="cm-banner__text">{{ tx('companion.action.offlineHint', 'TinyBot is offline. Commands wait until it is back online.') }}</span>
                </div>

                <article class="nx-card cm-story">
                  <span class="nx-icon-tile nx-icon-tile--lg" aria-hidden="true"><i class="el-icon-reading"></i></span>
                  <div class="cm-story__body">
                    <h2 class="nx-headline">{{ $t('companion.action.story') }}</h2>
                    <div class="cm-inline-form">
                      <el-input v-model="storyTopic" maxlength="64" clearable :placeholder="$t('companion.action.storyTopic')"
                        :aria-label="$t('companion.action.storyTopic')" @keyup.enter.native="sendStory" />
                      <el-button type="primary" :loading="commandBusy === 'story'" @click="sendStory">
                        {{ $t('companion.action.tellStory') }}
                      </el-button>
                    </div>
                  </div>
                </article>

                <h2 class="cm-subhead">{{ $t('companion.action.quick') }}</h2>
                <div class="cm-action-grid">
                  <button v-for="a in quickActions" :key="a.type + a.arg" type="button" class="cm-action"
                    :disabled="!!commandBusy" :aria-busy="commandBusy === a.type + a.arg ? 'true' : 'false'"
                    @click="sendCommand(a.type, actionArg(a), a.focus ? $t('companion.focus.started') : null, a.type + a.arg)">
                    <span class="cm-action__icon" aria-hidden="true">
                      <i :class="commandBusy === a.type + a.arg ? 'el-icon-loading' : a.icon"></i>
                    </span>
                    <span class="cm-action__text">
                      <span class="cm-action__label">{{ $t(a.label) }}</span>
                      <span v-if="a.focus" class="cm-action__sub nx-num">
                        {{ tx('companion.action.focusMinutes', '{n} min · Focus timer setting', { n: focusMinutes }) }}
                      </span>
                    </span>
                  </button>
                </div>

                <h2 class="cm-subhead">{{ $t('companion.action.games') }}</h2>
                <div class="cm-action-grid">
                  <button v-for="g in games" :key="g" type="button" class="cm-action cm-action--game"
                    :disabled="!!commandBusy" :aria-busy="commandBusy === 'game' + g ? 'true' : 'false'"
                    @click="sendCommand('game', g, null, 'game' + g)">
                    <span class="cm-action__icon" aria-hidden="true">
                      <i :class="commandBusy === 'game' + g ? 'el-icon-loading' : gameIcon(g)"></i>
                    </span>
                    <span class="cm-action__label">{{ gameName(g) }}</span>
                  </button>
                </div>

                <article class="nx-card cm-gap-top-lg">
                  <header class="nx-card__header">
                    <h2 class="nx-headline">{{ $t('companion.action.recent') }}</h2>
                  </header>
                  <div v-if="!commands.length" class="nx-empty cm-empty-sm">
                    <span class="nx-icon-tile nx-icon-tile--neutral" aria-hidden="true"><i class="el-icon-magic-stick"></i></span>
                    <p class="nx-empty__text">{{ $t('companion.action.noCommands') }}</p>
                  </div>
                  <ul v-else class="cm-commands">
                    <li v-for="c in commands.slice(0, 10)" :key="c.id" class="cm-command">
                      <span class="cm-command__name nx-truncate">{{ commandName(c) }}</span>
                      <span class="cm-command__time nx-num">{{ ago(c.ts) }}</span>
                      <span class="nx-badge" :class="c.status === 'done' ? 'nx-badge--success' : 'nx-badge--warning'">
                        {{ $t(c.status === 'done' ? 'companion.action.done' : 'companion.action.pending') }}
                      </span>
                    </li>
                  </ul>
                </article>
              </section>
            </transition>
          </div>
        </div>
      </template>
    </main>

    <!-- Alarm sheet -->
    <el-dialog :title="alarmDialog.isNew ? $t('companion.alarm.add') : $t('companion.alarm.edit')"
      :visible.sync="alarmDialog.visible" :width="dialogWidth" top="0" :append-to-body="true"
      :close-on-click-modal="false" class="cm-dialog" custom-class="cm-sheet">
      <el-form v-if="alarmDialog.form" label-position="top" @submit.native.prevent>
        <div class="cm-sheet__time">
          <el-time-picker v-model="alarmDialog.form.time" value-format="HH:mm" format="HH:mm" :clearable="false"
            class="cm-big-time" :aria-label="$t('companion.alarm.time')" />
        </div>
        <el-form-item :label="$t('companion.days')">
          <div class="cm-day-picker" role="group" :aria-label="$t('companion.days')">
            <button v-for="d in 7" :key="'d' + d" type="button" class="cm-day-toggle"
              :class="{ 'is-on': hasDay(alarmDialog.form.days, d - 1) }" :aria-pressed="hasDay(alarmDialog.form.days, d - 1) ? 'true' : 'false'"
              @click="alarmDialog.form.days = toggleDay(alarmDialog.form.days, d - 1)">{{ $t('companion.day.' + (d - 1)) }}</button>
          </div>
          <div class="cm-presets">
            <button v-for="p in dayPresets" :key="p.key" type="button" class="cm-preset"
              :class="{ 'is-on': alarmDialog.form.days === p.mask }" @click="alarmDialog.form.days = p.mask">
              {{ $t('companion.preset.' + p.key) }}</button>
          </div>
          <div class="cm-help">{{ daysText(alarmDialog.form.days) }}</div>
        </el-form-item>
        <el-form-item :label="$t('companion.label')">
          <el-input :value="alarmDialog.form.label" :maxlength="maxLabel" show-word-limit
            @input="(v) => alarmDialog.form.label = asciiLabel(v)" />
          <div class="cm-help">{{ $t('companion.labelHint') }}</div>
        </el-form-item>
        <el-form-item :label="$t('companion.say')">
          <el-input v-model="alarmDialog.form.say" type="textarea" :autosize="{ minRows: 2, maxRows: 6 }" :maxlength="maxSay" show-word-limit
            :placeholder="$t('companion.alarm.sayPlaceholder', sayTokens)" />
          <div class="cm-help">{{ $t('companion.sayHint', sayTokens) }}</div>
        </el-form-item>
        <div class="cm-settings">
          <div class="cm-setting">
            <span>{{ $t('companion.alarm.snooze') }}</span>
            <el-input-number v-model="alarmDialog.form.snooze_min" :min="0" :max="60" size="small" controls-position="right" />
          </div>
          <div class="cm-setting">
            <span>{{ $t('companion.enabled') }}</span>
            <el-switch v-model="alarmDialog.form.enabled" :aria-label="$t('companion.enabled')" />
          </div>
        </div>
      </el-form>
      <span slot="footer" class="cm-sheet__footer">
        <el-button @click="alarmDialog.visible = false">{{ $t('button.cancel') }}</el-button>
        <el-button type="primary" :loading="saving.alarms" @click="saveAlarm">{{ $t('companion.save') }}</el-button>
      </span>
    </el-dialog>

    <!-- TinyBot's day: one activity -->
    <el-dialog :title="dayDialog.index < 0 ? $t('companion.routine.add') : $t('companion.routine.edit')"
      :visible.sync="dayDialog.visible" :width="dialogWidth" top="0" :append-to-body="true"
      :close-on-click-modal="false" class="cm-dialog" custom-class="cm-sheet">
      <el-form v-if="dayDialog.form" label-position="top" @submit.native.prevent>
        <div class="cm-times">
          <el-form-item :label="$t('companion.routine.start')">
            <el-time-picker v-model="dayDialog.form.start" value-format="HH:mm" format="HH:mm" :clearable="false"
              class="cm-time-input" />
          </el-form-item>
          <i class="el-icon-right cm-times__arrow" aria-hidden="true"></i>
          <el-form-item :label="$t('companion.routine.end')">
            <el-time-picker v-model="dayDialog.form.end" value-format="HH:mm" format="HH:mm" :clearable="false"
              class="cm-time-input" />
          </el-form-item>
        </div>
        <p v-if="dayDialogProblem" class="cm-day-error" role="alert">{{ dayDialogProblem }}</p>
        <p v-else-if="dayDialogNextDay" class="cm-help">{{ $t('companion.routine.nextDayHint') }}</p>
        <el-form-item :label="$t('companion.routine.activityLabel')">
          <el-select v-model="dayDialog.form.activity" class="cm-day-select" :aria-label="$t('companion.routine.activityLabel')">
            <el-option v-for="a in activities" :key="a" :value="a" :label="activityIcons[a] + '  ' + activityName(a)" />
          </el-select>
          <div v-if="isMealActivity(dayDialog.form.activity)" class="cm-help">{{ $t('companion.routine.mealHint') }}</div>
        </el-form-item>
      </el-form>
      <span slot="footer" class="cm-sheet__footer">
        <el-button @click="dayDialog.visible = false">{{ $t('button.cancel') }}</el-button>
        <el-button type="primary" :disabled="!!dayDialogProblem" @click="applyDayItem">{{ $t('companion.routine.apply') }}</el-button>
      </span>
    </el-dialog>

    <!-- Reminder sheet -->
    <el-dialog :title="reminderDialog.isNew ? $t('companion.reminder.add') : $t('companion.reminder.edit')"
      :visible.sync="reminderDialog.visible" :width="dialogWidth" top="0" :append-to-body="true"
      :close-on-click-modal="false" class="cm-dialog" custom-class="cm-sheet">
      <el-form v-if="reminderDialog.form" label-position="top" @submit.native.prevent>
        <el-form-item :label="$t('companion.reminder.kindLabel')">
          <div class="nx-segmented cm-segmented" role="radiogroup" :aria-label="$t('companion.reminder.kindLabel')">
            <button v-for="kind in reminderKinds" :key="kind" type="button" role="radio"
              :aria-checked="reminderDialog.form.kind === kind ? 'true' : 'false'"
              :class="{ 'is-active': reminderDialog.form.kind === kind }" @click="reminderDialog.form.kind = kind">
              <i :class="kindIcon(kind)" aria-hidden="true"></i> {{ $t('companion.reminder.kind.' + kind) }}
            </button>
          </div>
        </el-form-item>
        <el-form-item :label="$t('companion.reminder.mode')">
          <div class="nx-segmented cm-segmented" role="radiogroup" :aria-label="$t('companion.reminder.mode')">
            <button type="button" role="radio" :aria-checked="reminderDialog.form.mode === 'interval' ? 'true' : 'false'"
              :class="{ 'is-active': reminderDialog.form.mode === 'interval' }" @click="reminderDialog.form.mode = 'interval'">
              {{ $t('companion.reminder.modeInterval') }}</button>
            <button type="button" role="radio" :aria-checked="reminderDialog.form.mode === 'time' ? 'true' : 'false'"
              :class="{ 'is-active': reminderDialog.form.mode === 'time' }" @click="reminderDialog.form.mode = 'time'">
              {{ $t('companion.reminder.modeTime') }}</button>
          </div>
        </el-form-item>
        <template v-if="reminderDialog.form.mode === 'interval'">
          <el-form-item :label="$t('companion.reminder.every')">
            <el-input-number v-model="reminderDialog.form.every_min" :min="5" :max="720" :step="5" controls-position="right" />
          </el-form-item>
          <div class="cm-times">
            <el-form-item :label="$t('companion.reminder.from')">
              <el-time-picker v-model="reminderDialog.form.from" value-format="HH:mm" format="HH:mm" :clearable="false"
                class="cm-time-input" />
            </el-form-item>
            <i class="el-icon-right cm-times__arrow" aria-hidden="true"></i>
            <el-form-item :label="$t('companion.reminder.to')">
              <el-time-picker v-model="reminderDialog.form.to" value-format="HH:mm" format="HH:mm" :clearable="false"
                class="cm-time-input" />
            </el-form-item>
          </div>
        </template>
        <el-form-item v-else :label="$t('companion.reminder.time')">
          <el-time-picker v-model="reminderDialog.form.time" value-format="HH:mm" format="HH:mm" :clearable="false"
            class="cm-time-input" />
        </el-form-item>
        <el-form-item :label="$t('companion.days')">
          <div class="cm-day-picker" role="group" :aria-label="$t('companion.days')">
            <button v-for="d in 7" :key="'d' + d" type="button" class="cm-day-toggle"
              :class="{ 'is-on': hasDay(reminderDialog.form.days, d - 1) }" :aria-pressed="hasDay(reminderDialog.form.days, d - 1) ? 'true' : 'false'"
              @click="reminderDialog.form.days = toggleDay(reminderDialog.form.days, d - 1)">{{ $t('companion.day.' + (d - 1)) }}</button>
          </div>
          <div class="cm-presets">
            <button v-for="p in dayPresets" :key="p.key" type="button" class="cm-preset"
              :class="{ 'is-on': reminderDialog.form.days === p.mask }" @click="reminderDialog.form.days = p.mask">
              {{ $t('companion.preset.' + p.key) }}</button>
          </div>
        </el-form-item>
        <el-form-item :label="$t('companion.label')">
          <el-input :value="reminderDialog.form.label" :maxlength="maxLabel" show-word-limit
            @input="(v) => reminderDialog.form.label = asciiLabel(v)" />
          <div class="cm-help">{{ $t('companion.labelHint') }}</div>
        </el-form-item>
        <el-form-item :label="$t('companion.say')">
          <el-input v-model="reminderDialog.form.say" type="textarea" :autosize="{ minRows: 2, maxRows: 6 }" :maxlength="maxSay" show-word-limit />
          <div class="cm-help">{{ $t('companion.sayHint', sayTokens) }}</div>
        </el-form-item>
        <div class="cm-settings">
          <div class="cm-setting">
            <span>{{ $t('companion.enabled') }}</span>
            <el-switch v-model="reminderDialog.form.enabled" :aria-label="$t('companion.enabled')" />
          </div>
        </div>
      </el-form>
      <span slot="footer" class="cm-sheet__footer">
        <el-button @click="reminderDialog.visible = false">{{ $t('button.cancel') }}</el-button>
        <el-button type="primary" :loading="saving.reminders" @click="saveReminder">{{ $t('companion.save') }}</el-button>
      </span>
    </el-dialog>

    <VersionFooter />
  </div>
</template>

<script>
import Api from '@/apis/api';
import HeaderBar from '@/components/HeaderBar.vue';
import VersionFooter from '@/components/VersionFooter.vue';
import TinyBotDayPreview from '@/components/TinyBotDayPreview.vue';
import TinyBotLiveScreen from '@/components/TinyBotLiveScreen.vue';
import {
  ACTIVITIES,
  ACTIVITY_ICON,
  DAY_PRESETS,
  DIM_PRESETS,
  DISPLAY_DEFAULTS,
  DISPLAY_MAX,
  GAMES,
  MAX_ALARMS,
  MAX_LABEL,
  MAX_MESSAGE,
  MAX_NAME,
  MAX_REMINDERS,
  MAX_ROUTINE,
  MAX_SAY,
  NIGHT_LIGHT_MAX,
  NIGHT_LIGHT_PRESETS,
  OFF_PRESETS,
  PRAYER_ROWS,
  REMINDER_KINDS,
  ROBOT_PAGES,
  ageOf,
  alarmPayload,
  asciiLabel,
  daysOf,
  daysPreset,
  defaultRoutine,
  displayProblem,
  displaySettings,
  formatClock,
  hasDay,
  highScores,
  isLastPageOn,
  isMinutes,
  isTime,
  messageStatus,
  minuteOfDay,
  newAlarm,
  newReminder,
  newRoutineItem,
  nextPrayer,
  normalizeRoutine,
  presetChoice,
  reminderPayload,
  removeById,
  robotPages,
  routineItemMinutes,
  routineItemProblem,
  routineOverlaps,
  routinePayload,
  routineProblem,
  sameRoutine,
  scheduledActivity,
  setEnabled,
  sortRoutine,
  toggleDay,
  upsertById,
} from '@/utils/companion.mjs';

const REFRESH_MS = 10000;
const FROM_KEY = 'companion_message_from';
const FORM_SECTIONS = ['pomodoro', 'routine', 'night', 'care', 'sound', 'display', 'robot'];
// Minute pickers with presets: which form field each one edits
const MINUTE_PICKERS = {
  dim: { section: 'display', field: 'dim_after_min', presets: DIM_PRESETS, max: DISPLAY_MAX.dim_after_min },
  off: { section: 'display', field: 'off_after_min', presets: OFF_PRESETS, max: DISPLAY_MAX.off_after_min },
  light: { section: 'night', field: 'light_minutes', presets: NIGHT_LIGHT_PRESETS, max: NIGHT_LIGHT_MAX },
};

const MEAL_ACTIVITIES = ['breakfast', 'lunch', 'dinner'];

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
  components: { HeaderBar, VersionFooter, TinyBotDayPreview, TinyBotLiveScreen },
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
        routine: { enabled: true, items: [] },
        night: {},
        care: {},
        sound: { controlVolume: false, volume: 70, sounds: true },
        display: { ...DISPLAY_DEFAULTS },
        robot: { name: '', owner_name: '' },
      },
      baseline: {},
      // A minute picker switched to "Custom" keeps showing its number input
      customPick: { dim: false, off: false, light: false },
      minutePickers: MINUTE_PICKERS,
      saving: {
        pomodoro: false, routine: false, night: false, care: false, sound: false, display: false, robot: false,
        alarms: false, reminders: false, prayer: false, pages: false,
      },
      alarmDialog: { visible: false, isNew: true, form: null },
      reminderDialog: { visible: false, isNew: true, form: null },
      // TinyBot's day: add / edit one activity (index -1 = new), and the activity in the preview
      dayDialog: { visible: false, index: -1, form: null },
      dayPreview: '',
      activities: ACTIVITIES,
      activityIcons: ACTIVITY_ICON,
      maxRoutine: MAX_ROUTINE,
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
      robotPageKeys: ROBOT_PAGES,
      // Literal placeholders the server fills in; passed as params so vue-i18n keeps the braces
      sayTokens: { weather: '{weather}', date: '{date}', name: '{name}' },
      quickActions: [
        { type: 'lullaby', arg: '', icon: 'el-icon-headset', label: 'companion.action.lullaby' },
        { type: 'ring', arg: '', icon: 'el-icon-location-outline', label: 'companion.action.ring' },
        { type: 'breathe', arg: '', icon: 'el-icon-wind-power', label: 'companion.action.breathe' },
        { type: 'night_light', arg: 'on', icon: 'el-icon-sunny', label: 'companion.action.nightLightOn' },
        { type: 'night_light', arg: 'off', icon: 'el-icon-moon-night', label: 'companion.action.nightLightOff' },
        // Starts the Focus timer with its saved work minutes (shown on the tile)
        { type: 'pomodoro', arg: '', icon: 'el-icon-timer', label: 'companion.action.focus', focus: true },
        { type: 'stop', arg: '', icon: 'el-icon-video-pause', label: 'companion.action.stop' },
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
    // Robot info pages, all keys present (missing = shown)
    pages() {
      return robotPages(this.dev && this.dev.settings && this.dev.settings.pages);
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
      // Narrow screens get a bottom sheet (see .cm-sheet)
      return this.windowWidth < 600 ? '100%' : '520px';
    },
    sections() {
      return [
        { key: 'status', icon: 'el-icon-s-home', label: 'companion.tab.status' },
        { key: 'alarms', icon: 'el-icon-alarm-clock', label: 'companion.tab.alarms', count: this.alarms.length },
        { key: 'reminders', icon: 'el-icon-bell', label: 'companion.tab.reminders', count: this.reminders.length },
        { key: 'prayer', icon: 'el-icon-sunrise', label: 'companion.tab.prayer' },
        { key: 'focus', icon: 'el-icon-timer', label: 'companion.tab.focus' },
        { key: 'messages', icon: 'el-icon-chat-line-round', label: 'companion.tab.messages' },
        { key: 'day', icon: 'el-icon-coffee-cup', label: 'companion.tab.day' },
        { key: 'night', icon: 'el-icon-moon', label: 'companion.tab.night' },
        { key: 'sound', icon: 'el-icon-headset', label: 'companion.tab.sound' },
        { key: 'actions', icon: 'el-icon-magic-stick', label: 'companion.tab.actions' },
      ];
    },
    // Reminders grouped by type, in the fixed type order; unknown types go with "Other"
    reminderGroups() {
      return this.reminderKinds
        .map((kind) => ({
          kind,
          items: this.reminders.filter((r) => (this.reminderKinds.includes(r.kind) ? r.kind : 'custom') === kind),
        }))
        .filter((group) => group.items.length);
    },
    // The robot's real speaker volume as it last reported it (null when unknown)
    robotVolume() {
      const v = Number(this.stats.volume);
      return this.stats.volume !== undefined && this.stats.volume !== null && Number.isFinite(v) ? v : null;
    },
    robotVolumeText() {
      return this.robotVolume === null
        ? this.tx('companion.sound.robotNowUnknown', 'TinyBot now: –')
        : this.tx('companion.sound.robotNow', 'TinyBot now: {n}%', { n: this.robotVolume });
    },
    // Work minutes the Focus timer starts with (the saved value, not an unsaved edit)
    focusMinutes() {
      const work = this.dev && this.dev.pomodoro && Number(this.dev.pomodoro.work_min);
      return work > 0 ? work : 25;
    },
    settingsVolumeText() {
      const settings = (this.dev && this.dev.settings) || {};
      return settings.volume !== null && settings.volume !== undefined
        ? this.tx('companion.status.volumeManual', 'Set from here')
        : this.tx('companion.status.volumeAuto', 'Set on the robot');
    },
    // ------------------------------------------------------------------ TinyBot's day
    // Minute of the day on this computer's clock (refreshed with every poll)
    dayMinute() {
      const d = new Date(this.now);
      return d.getHours() * 60 + d.getMinutes();
    },
    // What the edited day has scheduled right now ('' = nothing or switched off)
    dayNowActivity() {
      return scheduledActivity(this.forms.routine, this.dayMinute);
    },
    // Row of that activity (the first one covering now, like the robot)
    dayNowIndex() {
      if (!this.dayNowActivity) return -1;
      const m = this.dayMinute;
      return this.forms.routine.items.findIndex((item) => {
        const s = minuteOfDay(item.start);
        const e = minuteOfDay(item.end);
        return s < e ? m >= s && m < e : s > e && (m >= s || m < e);
      });
    },
    dayScheduledText() {
      return this.dayNowActivity
        ? this.$t('companion.routine.scheduledNow', { activity: this.activityName(this.dayNowActivity) })
        : this.$t('companion.routine.nothingNow');
    },
    // Preview: the picked activity, else what TinyBot shows now, else what is scheduled now
    previewActivity() {
      const shown = ACTIVITIES.includes(this.stats.activity) ? this.stats.activity : '';
      return this.dayPreview || shown || this.dayNowActivity || 'exercise';
    },
    dayOverlaps() {
      return routineOverlaps(this.forms.routine.items);
    },
    dayOverlapRows() {
      const rows = {};
      this.dayOverlaps.forEach(([a, b]) => { rows[a] = true; rows[b] = true; });
      return rows;
    },
    isDefaultDay() {
      return sameRoutine(this.forms.routine, { enabled: this.forms.routine.enabled, items: defaultRoutine().items });
    },
    dayDialogProblem() {
      const form = this.dayDialog.form;
      if (!form) return '';
      const code = routineItemProblem(form);
      if (code === 'time') return this.$t('companion.timeRequired');
      if (code === 'sameTime') return this.$t('companion.routine.sameTime');
      if (code === 'activity') return this.$t('companion.routine.badActivity');
      return '';
    },
    dayDialogNextDay() {
      const form = this.dayDialog.form;
      return !!form && minuteOfDay(form.end) < minuteOfDay(form.start);
    },
    wifiQuality() {
      const rssi = Number(this.stats.rssi);
      if (!this.stats.rssi || !Number.isFinite(rssi)) return this.stats.ip || '–';
      if (rssi >= -60) return this.tx('companion.status.wifiGood', 'Strong signal');
      if (rssi >= -72) return this.tx('companion.status.wifiFair', 'Fair signal');
      return this.tx('companion.status.wifiWeak', 'Weak signal');
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
    isLastPageOn,
    // Pending i18n keys fall back to their English text until the lead merges them
    tx(key, fallback, params) {
      if (this.$te(key) || this.$te(key, 'en')) return this.$t(key, params);
      if (!params) return fallback;
      return fallback.replace(/\{(\w+)\}/g, (match, name) => (params[name] !== undefined ? params[name] : match));
    },
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
        case 'routine':
          // missing on older servers and robots: the default day
          return normalizeRoutine(settings.routine);
        case 'night': {
          const night = clone(settings.night || {});
          // 0 = until the night ends (missing on older servers)
          if (!isMinutes(night.light_minutes, NIGHT_LIGHT_MAX)) night.light_minutes = 0;
          return night;
        }
        case 'care':
          return clone(settings.care || {});
        case 'display':
          return displaySettings(settings.display);
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
        case 'routine':
          // the server replaces the whole list
          return { settings: { routine: routinePayload(form) } };
        case 'night':
          return { settings: { night: { ...form } } };
        case 'care':
          return { settings: { care: { ...form } } };
        case 'sound':
          return { settings: { volume: form.controlVolume ? form.volume : null, sounds: !!form.sounds } };
        case 'display':
          return { settings: { display: { dim_after_min: form.dim_after_min, off_after_min: form.off_after_min } } };
        case 'robot':
          return {
            name: (form.name || '').trim() || 'TinyBot',
            settings: { owner_name: (form.owner_name || '').trim() },
          };
        default:
          return {};
      }
    },
    // Why a section can't be saved yet (a translated text), or ''
    sectionProblem(section) {
      const form = this.forms[section] || {};
      if (section === 'night') {
        if (!isTime(form.start) || !isTime(form.end)) return this.$t('companion.timeRequired');
        if (!isMinutes(form.light_minutes, NIGHT_LIGHT_MAX)) {
          return this.tx('companion.night.lightRange', 'Night light: choose 0 to {max} minutes', { max: NIGHT_LIGHT_MAX });
        }
      }
      if (section === 'routine') {
        const problem = routineProblem(form);
        if (problem && problem.code === 'tooMany') return this.$t('companion.routine.tooMany', { max: MAX_ROUTINE });
        if (problem && problem.code === 'sameTime') return this.$t('companion.routine.sameTime');
        if (problem && problem.code === 'activity') return this.$t('companion.routine.badActivity');
        if (problem) return this.$t('companion.timeRequired');
      }
      if (section === 'display') {
        const problem = displayProblem(form);
        if (problem === 'dimRange') {
          return this.tx('companion.display.dimRange', 'Dim after: choose 0 to {max} minutes', { max: DISPLAY_MAX.dim_after_min });
        }
        if (problem === 'offRange') {
          return this.tx('companion.display.offRange', 'Turn off after: choose 0 to {max} minutes', { max: DISPLAY_MAX.off_after_min });
        }
        if (problem === 'offBeforeDim') {
          return this.tx('companion.display.offBeforeDim',
            'The screen dims first: pick a later “Turn off” time, or “Never” for one of them.');
        }
      }
      return '';
    },
    // Toast after saving the Sound card: names the volume when it changed, else the generic "Saved"
    soundSavedText() {
      const form = this.forms.sound;
      let before = {};
      try {
        before = JSON.parse(this.baseline.sound || '{}') || {};
      } catch (e) { /* keep {} */ }
      if (!form.controlVolume || (before.controlVolume && before.volume === form.volume)) return undefined;
      return this.dev && this.dev.online === false
        ? this.tx('companion.sound.volumeSetOffline', 'Volume set to {n}%. TinyBot changes it when it is back online.', { n: form.volume })
        : this.tx('companion.sound.volumeSetTo', 'Volume set to {n}%', { n: form.volume });
    },
    saveSection(section) {
      const problem = this.sectionProblem(section);
      if (problem) {
        this.$message.warning(problem);
        return;
      }
      const okMessage = section === 'sound' ? this.soundSavedText() : undefined;
      this.savePatch(this.sectionPatch(section), section, okMessage)
        .then(() => {
          this.syncForms(true, section);
          // TinyBot reports its new volume right after changing it; show it before the next poll
          if (okMessage) {
            setTimeout(() => {
              if (!this._isDestroyed) this.refresh(true);
            }, 1500);
          }
        })
        .catch(() => {});
    },
    // Drop unsaved edits of a section
    revertSection(section) {
      this.syncForms(true, section);
      Object.keys(MINUTE_PICKERS).forEach((key) => {
        if (MINUTE_PICKERS[key].section === section) this.customPick[key] = false;
      });
    },

    // ------------------------------------------------------------------ minute pickers (presets + custom)
    minutesLabel(n, zeroKey, zeroFallback) {
      if (n === 0) return this.tx(zeroKey, zeroFallback);
      return this.tx('companion.minutesShort', '{n} min', { n });
    },
    pickerChoice(key) {
      const picker = MINUTE_PICKERS[key];
      if (this.customPick[key]) return 'custom';
      return presetChoice(this.forms[picker.section][picker.field], picker.presets);
    },
    pickMinutes(key, choice) {
      const picker = MINUTE_PICKERS[key];
      if (choice === 'custom') {
        this.customPick[key] = true;
        return;
      }
      this.customPick[key] = false;
      this.forms[picker.section][picker.field] = choice;
    },
    // Quick action argument: the Focus tile sends the saved work minutes
    actionArg(a) {
      return a.focus ? String(this.focusMinutes) : a.arg;
    },

    // Show or hide one robot page; optimistic, reverted when the save fails
    setPage(key, on) {
      if (!this.dev || (!on && isLastPageOn(this.pages, key))) return;
      const before = this.dev.settings && this.dev.settings.pages;
      this.dev = { ...this.dev, settings: { ...this.dev.settings, pages: { ...this.pages, [key]: !!on } } };
      this.savePatch({ settings: { pages: { [key]: !!on } } }, 'pages').catch(() => {
        if (this.dev) this.dev = { ...this.dev, settings: { ...this.dev.settings, pages: before } };
      });
    },

    // ------------------------------------------------------------------ TinyBot's day
    activityName(activity) {
      return this.tx('companion.routine.activity.' + activity, activity || '-');
    },
    isMealActivity(activity) {
      return MEAL_ACTIVITIES.includes(activity);
    },
    durationText(item) {
      const n = routineItemMinutes(item);
      const h = Math.floor(n / 60);
      const m = n % 60;
      let text = this.$t('companion.routine.durationMin', { n });
      if (h && m) text = this.$t('companion.routine.durationHours', { h, m });
      else if (h) text = this.$t('companion.routine.durationHoursOnly', { h });
      return minuteOfDay(item.end) < minuteOfDay(item.start) ? text + ' · ' + this.$t('companion.routine.nextDay') : text;
    },
    overlapText([a, b]) {
      const items = this.forms.routine.items;
      const label = (item) => item.start + '–' + item.end + ' ' + this.activityName(item.activity);
      return this.$t('companion.routine.overlap', { a: label(items[a]), b: label(items[b]) });
    },
    openDayItem(index) {
      const items = this.forms.routine.items;
      if (index < 0 && items.length >= MAX_ROUTINE) return;
      const form = index < 0 ? newRoutineItem(items) : { ...items[index] };
      this.dayDialog = { visible: true, index, form };
    },
    // Apply the dialog to the edited day (sent with the card's Save button)
    applyDayItem() {
      const { form, index } = this.dayDialog;
      if (!form || routineItemProblem(form)) return;
      const item = { start: form.start, end: form.end, activity: form.activity };
      const items = this.forms.routine.items.slice();
      if (index < 0) items.push(item);
      else items.splice(index, 1, item);
      this.forms.routine.items = sortRoutine(items);
      this.dayPreview = item.activity;
      this.dayDialog.visible = false;
    },
    removeDayItem(index) {
      const items = this.forms.routine.items.slice();
      items.splice(index, 1);
      this.forms.routine.items = items;
    },
    resetDay() {
      this.forms.routine.items = defaultRoutine().items;
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
    kindIcon(kind) {
      return { water: 'el-icon-cold-drink', medicine: 'el-icon-first-aid-kit' }[kind] || 'el-icon-bell';
    },
    dayPresetKey(mask) {
      return daysPreset(mask);
    },
    dayList(mask) {
      return daysOf(mask);
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
    isNextPrayer(key) {
      return !!(this.upcomingPrayer && !this.upcomingPrayer.tomorrow && this.upcomingPrayer.key === key);
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
    statusBadge(m) {
      return { yes: 'success', no: 'danger', seen: 'success', delivered: 'info', pending: 'warning' }[messageStatus(m)];
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
    gameIcon(game) {
      return {
        catch: 'el-icon-basketball', simon: 'el-icon-s-grid', dice: 'el-icon-coin', reaction: 'el-icon-stopwatch',
      }[game] || 'el-icon-trophy';
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
    // Icon and tone for a timeline entry
    eventVisual(e) {
      const type = (e && e.type) || '';
      if (type === 'dropped') return { icon: 'el-icon-warning-outline', tone: 'danger' };
      if (/missed$/.test(type)) return { icon: 'el-icon-warning-outline', tone: 'warning' };
      if (type === 'lonely') return { icon: 'el-icon-cloudy', tone: 'warning' };
      if (type.indexOf('alarm') === 0) return { icon: 'el-icon-alarm-clock', tone: 'accent' };
      if (type.indexOf('reminder') === 0) return { icon: 'el-icon-bell', tone: 'success' };
      if (type.indexOf('prayer') === 0) return { icon: 'el-icon-sunrise', tone: 'info' };
      if (type === 'pomodoro_done') return { icon: 'el-icon-timer', tone: 'success' };
      if (type === 'game_score') return { icon: 'el-icon-trophy', tone: 'accent' };
      if (type === 'streak') return { icon: 'el-icon-medal', tone: 'accent' };
      return { icon: 'el-icon-time', tone: 'neutral' };
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
// TinyBot's home: calm cards on the warm background, one accent per region.

.cm {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--nx-bg);

  > .cm-page {
    flex: 1 0 auto;
  }
}

.cm-gap-top {
  margin-top: var(--nx-space-3);
}
.cm-gap-top-lg {
  margin-top: var(--nx-space-5);
}
.cm-help {
  margin-top: var(--nx-space-1);
  font-size: var(--nx-text-caption);
  line-height: 1.4;
  color: var(--nx-text-3);
}

// ------------------------------------------------------------------ header

.cm-hero {
  display: flex;
  align-items: center;
  gap: var(--nx-space-4);
  margin: var(--nx-space-2) 0 var(--nx-space-6);
  min-width: 0;

  &__avatar {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 64px;
    height: 64px;
    border-radius: var(--nx-radius-lg);
    background: var(--nx-accent-soft);
    color: var(--nx-accent);
    font-size: var(--nx-text-display);
  }
  &__emoji {
    line-height: 1;
  }
  &__text {
    flex: 1;
    min-width: 0;
  }
  &__eyebrow {
    font-size: var(--nx-text-footnote);
    font-weight: 600;
    color: var(--nx-accent);
  }
  &__chips {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--nx-space-2);
    margin-top: var(--nx-space-2);
  }
  &__seen {
    font-size: var(--nx-text-footnote);
    color: var(--nx-text-2);
  }
  &__refresh {
    align-self: flex-start;
    &:disabled {
      cursor: default;
    }
  }
}

.cm-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 22px;
  padding: 0 9px;
  border-radius: var(--nx-radius-pill);
  border: 1px solid var(--nx-border);
  background: var(--nx-surface);
  color: var(--nx-text-2);
  font-size: var(--nx-text-caption);
  font-weight: 600;
  white-space: nowrap;
}

.cm-sk-title {
  display: inline-block;
  width: 180px;
  height: 24px;
}

.cm-banner {
  display: flex;
  align-items: center;
  gap: var(--nx-space-3);
  margin-bottom: var(--nx-space-5);
  padding: var(--nx-space-3) var(--nx-space-4);
  border-radius: var(--nx-radius);
  background: var(--nx-danger-soft);
  color: var(--nx-danger);
  font-size: var(--nx-text-callout);

  &__text {
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  &--info {
    background: var(--nx-info-soft);
    color: var(--nx-info);
  }
}

// ------------------------------------------------------------------ layout + section list

.cm-layout {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: var(--nx-space-6);
  align-items: start;
}

.cm-nav {
  position: sticky;
  top: calc(var(--nx-topbar-h) + var(--nx-space-5));
  display: flex;
  flex-direction: column;
  gap: 2px;

  &__item {
    display: flex;
    align-items: center;
    gap: var(--nx-space-3);
    width: 100%;
    min-height: 40px;
    padding: 0 var(--nx-space-3);
    border: 0;
    border-radius: var(--nx-radius);
    background: transparent;
    color: var(--nx-text-2);
    font: inherit;
    font-size: var(--nx-text-callout);
    font-weight: 500;
    text-align: left;
    cursor: pointer;
    transition: background-color var(--nx-dur-1) var(--nx-ease), color var(--nx-dur-1) var(--nx-ease),
      transform var(--nx-dur-1) var(--nx-ease);

    i {
      font-size: var(--nx-text-headline);
      width: 18px;
      text-align: center;
    }
    &:hover {
      background: var(--nx-surface-2);
      color: var(--nx-text);
    }
    &:active {
      transform: scale(0.98);
    }
    &.is-active {
      background: var(--nx-accent-soft);
      color: var(--nx-accent);
      font-weight: 600;
    }
  }
  &__label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  &__count {
    min-width: 22px;
    padding: 1px 7px;
    border-radius: var(--nx-radius-pill);
    background: var(--nx-surface-2);
    color: var(--nx-text-2);
    font-size: var(--nx-text-caption);
    font-weight: 600;
    text-align: center;
  }
  &__item.is-active &__count {
    background: var(--nx-surface);
    color: var(--nx-accent);
  }

  &--skeleton {
    gap: var(--nx-space-3);
    padding-top: var(--nx-space-2);
  }
}
.cm-sk-nav {
  height: 20px;
  width: 80%;
}

.cm-content,
.cm-section {
  min-width: 0;
}

.cm-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: var(--nx-space-5);
  align-items: start;
  margin-top: var(--nx-space-5);
}
.cm-section.cm-grid {
  margin-top: 0;
}
.cm-grid--messages {
  grid-template-columns: minmax(0, 5fr) minmax(0, 6fr);
}

.cm-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--nx-space-3);
  padding: var(--nx-space-5);
  border-bottom: 1px solid var(--nx-border);

  .nx-caption {
    margin: 2px 0 0;
  }
}

.cm-empty-sm {
  padding: var(--nx-space-6) var(--nx-space-4);
}

// ------------------------------------------------------------------ status

// Six tiles: 3 + 3 on wide screens, 2 + 2 + 2 below, never a lone orphan tile
.cm-live {
  margin-bottom: var(--nx-space-4);

  .tls {
    max-width: 640px;
  }
}

.cm-tiles {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--nx-space-4);
}
@media (max-width: 640px) {
  .cm-tiles {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.cm-tile {
  display: flex;
  flex-direction: column;
  gap: var(--nx-space-1);
  min-height: 116px;
  padding: var(--nx-space-4);

  &__value {
    display: flex;
    align-items: center;
    gap: var(--nx-space-2);
    min-width: 0;
  }
  &__emoji {
    font-size: var(--nx-text-title);
    line-height: 1;
  }
  &__unit {
    margin-left: 2px;
    font-size: var(--nx-text-callout);
    font-weight: 500;
    color: var(--nx-text-3);
    letter-spacing: 0;
  }
  .nx-stat__meta {
    margin-top: auto;
  }
}
.cm-sk-line {
  width: 50%;
  height: 12px;
}
.cm-sk-value {
  width: 40%;
  height: 26px;
  margin-top: var(--nx-space-2);
}

.cm-meter {
  display: block;
  height: 6px;
  margin: var(--nx-space-1) 0;
  border-radius: var(--nx-radius-pill);
  background: var(--nx-surface-3);
  overflow: hidden;

  &__fill {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: var(--nx-accent);
    transform-origin: left center;
    transition: transform var(--nx-dur-3) var(--nx-ease);
  }
}

.cm-kv {
  font-size: var(--nx-text-callout);
}
.cm-score + .cm-score::before {
  content: " · ";
  color: var(--nx-text-3);
}

.cm-weather {
  display: flex;
  align-items: baseline;
  gap: var(--nx-space-3);
  flex-wrap: wrap;

  &__temp {
    font-size: var(--nx-text-display);
    font-weight: 700;
    letter-spacing: -0.022em;
    line-height: 1.19;
  }
  &__text {
    font-size: var(--nx-text-headline);
    color: var(--nx-text-2);
  }
}

.cm-next-prayer {
  display: flex;
  align-items: center;
  gap: var(--nx-space-3);
  margin-top: var(--nx-space-4);
  padding-top: var(--nx-space-4);
  border-top: 1px solid var(--nx-border);

  &__value {
    font-size: var(--nx-text-headline);
    font-weight: 600;
  }
}

.cm-timeline {
  margin: 0;
  padding: 0;
  list-style: none;

  &__item {
    position: relative;
    display: grid;
    grid-template-columns: 28px minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--nx-space-3);
    padding: var(--nx-space-2) 0;

    // Line connecting this entry's icon with the next one
    &:not(:last-child)::after {
      content: "";
      position: absolute;
      left: 13px;
      top: calc(50% + 16px);
      height: calc(100% - 32px);
      width: 2px;
      border-radius: var(--nx-radius-pill);
      background: var(--nx-border);
    }
  }
  &__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--nx-surface-2);
    color: var(--nx-text-2);
    font-size: var(--nx-text-callout);
  }
  &__text {
    font-size: var(--nx-text-callout);
    overflow-wrap: anywhere;
  }
  &__time {
    font-size: var(--nx-text-caption);
    color: var(--nx-text-3);
    white-space: nowrap;
  }

  .is-accent &__icon {
    background: var(--nx-accent-soft);
    color: var(--nx-accent);
  }
  .is-success &__icon {
    background: var(--nx-success-soft);
    color: var(--nx-success);
  }
  .is-warning &__icon {
    background: var(--nx-warning-soft);
    color: var(--nx-warning);
  }
  .is-danger &__icon {
    background: var(--nx-danger-soft);
    color: var(--nx-danger);
  }
  .is-info &__icon {
    background: var(--nx-info-soft);
    color: var(--nx-info);
  }
}

// ------------------------------------------------------------------ alarm + reminder rows

.cm-rows {
  margin: 0;
  padding: 0;
  list-style: none;
}

.cm-alarm,
.cm-reminder {
  display: flex;
  align-items: center;
  gap: var(--nx-space-3);
  padding: var(--nx-space-2) var(--nx-space-5) var(--nx-space-2) var(--nx-space-2);
  border-bottom: 1px solid var(--nx-border);

  &:last-child {
    border-bottom: 0;
  }
}

.cm-alarm__main,
.cm-reminder__main {
  display: flex;
  align-items: center;
  gap: var(--nx-space-5);
  flex: 1;
  min-width: 0;
  padding: var(--nx-space-3);
  border: 0;
  border-radius: var(--nx-radius);
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background-color var(--nx-dur-1) var(--nx-ease);

  &:hover {
    background: var(--nx-surface-2);
  }
}
.cm-reminder__main {
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}

.cm-alarm {
  &__time {
    flex: none;
    min-width: 2.9em;
    font-size: var(--nx-text-display);
    font-weight: 300;
    line-height: 1;
    letter-spacing: -0.03em;
    color: var(--nx-text);
  }
  &__body {
    display: flex;
    flex-direction: column;
    gap: var(--nx-space-1);
    min-width: 0;
    flex: 1;
  }
  &__label {
    font-size: var(--nx-text-body);
    font-weight: 600;
  }
  &__meta {
    font-size: var(--nx-text-caption);
    color: var(--nx-text-3);
  }
  &__say {
    max-width: 100%;
    font-size: var(--nx-text-footnote);
    color: var(--nx-text-2);
  }
}

.cm-alarm.is-off,
.cm-reminder.is-off {
  .cm-alarm__time,
  .cm-alarm__label,
  .cm-reminder__label {
    color: var(--nx-text-3);
  }
  .cm-day.is-on {
    background: var(--nx-surface-2);
    color: var(--nx-text-3);
  }
}

.cm-reminder {
  &__label {
    max-width: 100%;
    font-size: var(--nx-text-body);
    font-weight: 600;
  }
  &__when {
    font-size: var(--nx-text-footnote);
    color: var(--nx-text-2);
  }
}

.cm-days {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}
.cm-day {
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 7px;
  border-radius: var(--nx-radius-pill);
  background: var(--nx-surface-2);
  color: var(--nx-text-2);
  font-size: var(--nx-text-caption);
  font-weight: 600;
  &.is-on {
    background: var(--nx-accent-soft);
    color: var(--nx-accent);
  }
}

.cm-row-actions {
  display: flex;
  align-items: center;
  gap: var(--nx-space-1);
  flex: none;

  .el-switch {
    margin-right: var(--nx-space-2);
  }
}

.cm-group {
  & + & {
    border-top: 1px solid var(--nx-border);
  }
  &__title {
    display: flex;
    align-items: center;
    gap: var(--nx-space-3);
    margin: 0;
    padding: var(--nx-space-4) var(--nx-space-5) var(--nx-space-1);
    font-size: var(--nx-text-callout);
    font-weight: 600;
    color: var(--nx-text);
  }
}
.cm-kind {
  width: 32px;
  height: 32px;
  border-radius: var(--nx-radius-sm);
  font-size: var(--nx-text-headline);
  &--water {
    background: var(--nx-info-soft);
    color: var(--nx-info);
  }
  &--medicine {
    background: var(--nx-danger-soft);
    color: var(--nx-danger);
  }
}

// ------------------------------------------------------------------ settings rows and fields

.cm-settings {
  border-radius: var(--nx-radius);
  background: var(--nx-surface-2);
  padding: 0 var(--nx-space-4);
}
.cm-setting {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--nx-space-4);
  min-height: 48px;
  padding: var(--nx-space-2) 0;
  font-size: var(--nx-text-callout);

  & + & {
    border-top: 1px solid var(--nx-border);
  }
  > span {
    min-width: 0;
  }
  .el-switch,
  .el-input-number {
    flex: none;
  }
  &__text {
    display: flex;
    flex-direction: column;
  }
}

.cm-button-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--nx-space-2);

  .el-button + .el-button {
    margin-left: 0;
  }
}

.cm-field {
  display: flex;
  flex-direction: column;
  gap: 6px;

  &__label {
    font-size: var(--nx-text-footnote);
    color: var(--nx-text-2);
  }
}

.cm-times {
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: var(--nx-space-3);

  &__arrow {
    padding-bottom: 10px;
    color: var(--nx-text-3);
  }
}
.cm-time-input {
  width: 132px;
}

// Minute picker: preset select + number input for "Custom"
.cm-minutes {
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: var(--nx-space-3);

  > .cm-field {
    flex: 1 1 160px;
    min-width: 0;
  }
  &__select,
  .el-input-number {
    width: 100%;
  }
}

.cm-fields {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  column-gap: var(--nx-space-4);

  .el-input-number {
    width: 100%;
  }
}
.cm-form-card {
  max-width: 720px;
}

.cm-unsaved {
  margin-right: auto;
  font-size: var(--nx-text-caption);
  font-weight: 600;
  color: var(--nx-warning);
}

// ------------------------------------------------------------------ TinyBot's day

.cm-min {
  min-width: 0;
}

.cm-grid--day {
  grid-template-columns: minmax(0, 6fr) minmax(0, 5fr);
}

.cm-banner--warning {
  margin-bottom: var(--nx-space-3);
  background: var(--nx-warning-soft);
  color: var(--nx-text);
  font-size: var(--nx-text-footnote);

  > i {
    color: var(--nx-warning);
  }
}

.cm-day-intro {
  padding: var(--nx-space-4) var(--nx-space-5);
  border-bottom: 1px solid var(--nx-border);

  .cm-help {
    margin: 0 0 var(--nx-space-3);
  }
}

.cm-day-row {
  &__main {
    gap: var(--nx-space-3);
  }
  &__time {
    flex: none;
    min-width: 7.6em;
    font-size: var(--nx-text-headline);
    font-weight: 500;
    letter-spacing: -0.01em;
    color: var(--nx-text);
  }
  &__dash {
    padding: 0 3px;
    color: var(--nx-text-3);
  }
  &__icon {
    flex: none;
    width: 28px;
    font-size: 18px;
    line-height: 1;
    text-align: center;
  }
  &__warn {
    color: var(--nx-warning);
    font-weight: 600;
  }
  &.is-shown .cm-day-row__main {
    background: var(--nx-accent-soft);
  }
  &.is-now .cm-day-row__time {
    color: var(--nx-success);
  }
}

.cm-rows.is-off .cm-day-row {
  .cm-day-row__time,
  .cm-alarm__label {
    color: var(--nx-text-3);
  }
}

.cm-day-notes {
  padding: var(--nx-space-4) var(--nx-space-5) 0;

  .nx-footnote {
    margin: 0 0 var(--nx-space-2);
  }
}

.cm-day-foot {
  flex-wrap: wrap;
  margin-top: var(--nx-space-3);
  padding: var(--nx-space-4) var(--nx-space-5);

  &__reset {
    margin-right: auto;
  }
  &__reset + .cm-unsaved {
    margin-right: 0;
  }
}

.cm-day-preview {
  position: sticky;
  top: calc(var(--nx-topbar-h) + var(--nx-space-4));
}

.cm-day-now {
  margin: 0 0 var(--nx-space-2);
}

.cm-day-scheduled {
  margin: 0 0 var(--nx-space-3);
}

.cm-day-error {
  margin: calc(var(--nx-space-2) * -1) 0 var(--nx-space-3);
  font-size: var(--nx-text-footnote);
  color: var(--nx-danger);
}

.cm-day-select {
  width: 100%;
}

@media (max-width: 1100px) {
  .cm-grid--day {
    grid-template-columns: minmax(0, 1fr);
  }

  .cm-day-preview {
    position: static;
    order: -1;
  }
}

@media (max-width: 520px) {
  .cm-day-row__time {
    min-width: 0;
    font-size: var(--nx-text-callout);
  }
}

.cm-inline-form {
  display: flex;
  gap: var(--nx-space-2);
  margin-top: var(--nx-space-1);

  .el-input {
    flex: 1;
    min-width: 0;
  }
}

.cm-volume {
  margin-top: var(--nx-space-4);

  &__head {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: var(--nx-space-1) var(--nx-space-3);
  }
  &__head > .cm-field__label {
    margin-right: auto;
  }
  &__now {
    font-size: var(--nx-text-footnote);
    color: var(--nx-text-2);
  }
  &__value {
    font-size: var(--nx-text-headline);
    font-weight: 600;
  }
  &__slider {
    display: flex;
    align-items: center;
    gap: var(--nx-space-3);
    color: var(--nx-text-3);
    .el-slider {
      flex: 1;
    }
  }
  &.is-disabled &__value {
    color: var(--nx-text-3);
  }
}

// ------------------------------------------------------------------ prayer

.cm-prayers {
  margin: var(--nx-space-1) 0 0;
  padding: 0;
  list-style: none;
}
.cm-prayer {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 72px 64px;
  align-items: center;
  gap: var(--nx-space-3);
  min-height: 48px;
  padding: 0 var(--nx-space-3);
  border-radius: var(--nx-radius);

  & + & {
    margin-top: 2px;
  }
  &__name {
    display: flex;
    align-items: center;
    gap: var(--nx-space-2);
    font-size: var(--nx-text-callout);
    font-weight: 500;
  }
  &__time {
    font-size: var(--nx-text-headline);
    font-weight: 600;
    text-align: right;
  }
  &__col {
    text-align: right;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  &__tomorrow {
    font-size: var(--nx-text-footnote);
    color: var(--nx-text-3);
    text-align: right;
  }
  &--head {
    min-height: 0;
    margin-top: var(--nx-space-4);
    font-size: var(--nx-text-caption);
    font-weight: 600;
    color: var(--nx-text-3);
  }
  &.is-next {
    background: var(--nx-accent-soft);
    .cm-prayer__time,
    .cm-prayer__name {
      color: var(--nx-accent);
    }
  }
}

.cm-cities {
  margin: var(--nx-space-3) 0 0;
  padding: 0;
  list-style: none;
}
.cm-city {
  display: flex;
  align-items: center;
  gap: var(--nx-space-3);
  width: 100%;
  min-height: 52px;
  padding: var(--nx-space-2) var(--nx-space-3);
  border: 0;
  border-radius: var(--nx-radius);
  background: transparent;
  color: var(--nx-text);
  font: inherit;
  text-align: left;
  cursor: pointer;

  &:hover {
    background: var(--nx-surface-2);
  }
  &:disabled {
    cursor: progress;
    opacity: 0.6;
  }
  &__text {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
  }
  &__name {
    font-weight: 600;
  }
  i {
    color: var(--nx-text-3);
  }
}

// ------------------------------------------------------------------ messages

.cm-composer {
  &__bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--nx-space-3);
    flex-wrap: wrap;
    padding-top: var(--nx-space-4);
    border-top: 1px solid var(--nx-border);
  }
  &__ask {
    display: inline-flex;
    align-items: center;
    gap: var(--nx-space-2);
    font-size: var(--nx-text-callout);
    color: var(--nx-text-2);
    cursor: pointer;
  }
}

.cm-thread {
  display: flex;
  flex-direction: column;
  gap: var(--nx-space-3);
  max-height: 560px;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}
.cm-bubble-row {
  display: flex;
  justify-content: flex-end;
}
.cm-bubble {
  max-width: min(92%, 440px);
  padding: var(--nx-space-3) var(--nx-space-4);
  border-radius: var(--nx-radius-lg) var(--nx-radius-lg) var(--nx-radius-sm) var(--nx-radius-lg);
  background: var(--nx-accent-soft);

  &__text {
    margin: 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    color: var(--nx-text);
  }
  &__meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--nx-space-3);
    margin-top: var(--nx-space-2);
    font-size: var(--nx-text-caption);
    color: var(--nx-text-2);
    .nx-badge {
      flex: none;
      background: var(--nx-surface);
    }
  }
}

// ------------------------------------------------------------------ quick actions

.cm-story {
  display: flex;
  align-items: flex-start;
  gap: var(--nx-space-4);

  &__body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--nx-space-2);
  }
}

.cm-subhead {
  margin: var(--nx-space-6) 0 var(--nx-space-3);
  font-size: var(--nx-text-footnote);
  font-weight: 600;
  color: var(--nx-text-2);
}

.cm-action-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: var(--nx-space-3);
}

.cm-action {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--nx-space-4);
  min-height: 112px;
  padding: var(--nx-space-4);
  border: 1px solid var(--nx-border);
  border-radius: var(--nx-radius-lg);
  background: var(--nx-surface);
  box-shadow: var(--nx-shadow-1);
  color: var(--nx-text);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: box-shadow var(--nx-dur-2) var(--nx-ease), border-color var(--nx-dur-2) var(--nx-ease),
    transform var(--nx-dur-1) var(--nx-ease);

  &:hover:not(:disabled) {
    box-shadow: var(--nx-shadow-2);
    border-color: var(--nx-border-strong);
  }
  &:active:not(:disabled) {
    transform: scale(0.97);
  }
  &:disabled {
    cursor: default;
    opacity: 0.6;
  }
  &[aria-busy="true"] {
    opacity: 1;
    border-color: var(--nx-accent);
  }

  &__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: var(--nx-radius);
    background: var(--nx-accent-soft);
    color: var(--nx-accent);
    font-size: var(--nx-text-title);
  }
  &--game &__icon {
    background: var(--nx-info-soft);
    color: var(--nx-info);
  }
  &__text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  &__label {
    font-size: var(--nx-text-callout);
    font-weight: 600;
    overflow-wrap: anywhere;
  }
  &__sub {
    font-size: var(--nx-text-caption);
    color: var(--nx-text-3);
    overflow-wrap: anywhere;
  }
}

.cm-commands {
  margin: 0;
  padding: 0;
  list-style: none;
}
.cm-command {
  display: flex;
  align-items: center;
  gap: var(--nx-space-3);
  min-height: 48px;
  border-bottom: 1px solid var(--nx-border);

  &:last-child {
    border-bottom: 0;
  }
  &__name {
    flex: 1;
    font-size: var(--nx-text-callout);
  }
  &__time {
    font-size: var(--nx-text-caption);
    color: var(--nx-text-3);
    white-space: nowrap;
  }
}

// ------------------------------------------------------------------ responsive

@media (max-width: 1100px) {
  .cm-layout {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--nx-space-4);
  }
  // Section list becomes a horizontal segmented scroller pinned under the top bar
  .cm-nav {
    top: var(--nx-topbar-h);
    z-index: 2;
    flex-direction: row;
    gap: var(--nx-space-1);
    margin: 0 calc(-1 * var(--nx-gutter));
    padding: var(--nx-space-2) var(--nx-gutter);
    background: var(--nx-bg);
    overflow-x: auto;
    scrollbar-width: none;
    &::-webkit-scrollbar {
      display: none;
    }

    &__item {
      width: auto;
      flex: none;
      min-height: 36px;
      padding: 0 var(--nx-space-3);
      border: 1px solid var(--nx-border);
      border-radius: var(--nx-radius-pill);
      background: var(--nx-surface);
      &.is-active {
        border-color: transparent;
      }
    }
    &__label {
      overflow: visible;
    }
    &--skeleton {
      position: static;
    }
  }
  .cm-sk-nav {
    width: 96px;
    flex: none;
  }
  .cm-grid--messages {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 600px) {
  .cm-hero {
    align-items: flex-start;
    gap: var(--nx-space-3);
    &__avatar {
      width: 48px;
      height: 48px;
      font-size: var(--nx-text-title);
    }
  }
  .cm-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .cm-card-head {
    padding: var(--nx-space-4);
    flex-wrap: wrap;
  }
  .cm-alarm,
  .cm-reminder {
    flex-wrap: wrap;
    padding-right: var(--nx-space-3);
    row-gap: 0;
  }
  .cm-alarm__main {
    gap: var(--nx-space-4);
  }
  .cm-alarm__time {
    font-size: var(--nx-text-display);
  }
  .cm-row-actions {
    margin-left: auto;
    padding-bottom: var(--nx-space-2);
  }
  .cm-story {
    flex-direction: column;
  }
  .cm-inline-form {
    flex-wrap: wrap;
    .el-button {
      flex: 1 1 auto;
    }
  }
  .cm-action-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .cm-action {
    min-height: 100px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .cm-meter__fill,
  .cm-action {
    transition: none;
  }
}
</style>

<style lang="scss">
// Alarm / reminder sheets are appended to <body>: unscoped, every rule under .cm-dialog
.el-dialog__wrapper.cm-dialog {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--nx-space-5) 0;

  .el-dialog.cm-sheet {
    margin: auto;
    max-height: calc(100vh - 2 * var(--nx-space-5));
    display: flex;
    flex-direction: column;
  }
  .cm-sheet .el-dialog__body {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
  }
  .cm-sheet__footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--nx-space-2);
    .el-button + .el-button {
      margin-left: 0;
    }
  }
  .cm-sheet__time {
    display: flex;
    justify-content: center;
    margin-bottom: var(--nx-space-5);
    padding: var(--nx-space-4);
    border-radius: var(--nx-radius-lg);
    background: var(--nx-surface-2);
  }
  // The alarm time reads like a clock face
  .cm-big-time {
    width: 200px;
    .el-input__inner {
      height: 64px;
      padding: 0 var(--nx-space-4) 0 44px;
      background: var(--nx-surface);
      font-size: var(--nx-text-display);
      font-weight: 300;
      letter-spacing: -0.02em;
      font-variant-numeric: tabular-nums;
      text-align: center;
    }
    .el-input__prefix {
      left: 12px;
      display: flex;
      align-items: center;
    }
  }
  .cm-time-input {
    width: 132px;
  }
  .cm-day-picker {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 6px;
    width: 100%;
  }
  .cm-day-toggle {
    height: 40px;
    padding: 0 2px;
    border: 1px solid var(--nx-border);
    border-radius: var(--nx-radius);
    background: var(--nx-surface);
    color: var(--nx-text-2);
    font: inherit;
    font-size: var(--nx-text-footnote);
    font-weight: 600;
    cursor: pointer;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    transition: background-color var(--nx-dur-1) var(--nx-ease), color var(--nx-dur-1) var(--nx-ease),
      transform var(--nx-dur-1) var(--nx-ease);

    &:hover {
      border-color: var(--nx-border-strong);
    }
    &:active {
      transform: scale(0.95);
    }
    &.is-on {
      border-color: transparent;
      background: var(--nx-accent);
      color: var(--nx-on-accent);
    }
  }
  .cm-presets {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: var(--nx-space-2);
  }
  .cm-preset {
    height: 28px;
    padding: 0 var(--nx-space-3);
    border: 0;
    border-radius: var(--nx-radius-pill);
    background: var(--nx-surface-2);
    color: var(--nx-text-2);
    font: inherit;
    font-size: var(--nx-text-caption);
    font-weight: 600;
    cursor: pointer;
    &:hover {
      color: var(--nx-text);
    }
    &.is-on {
      background: var(--nx-accent-soft);
      color: var(--nx-accent);
    }
  }
  .cm-segmented {
    flex-wrap: wrap;
    max-width: 100%;
    > button {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
  }
  .cm-help {
    margin-top: var(--nx-space-1);
    font-size: var(--nx-text-caption);
    line-height: 1.4;
    color: var(--nx-text-3);
  }
  .cm-settings {
    border-radius: var(--nx-radius);
    background: var(--nx-surface-2);
    padding: 0 var(--nx-space-4);
  }
  .cm-setting {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--nx-space-4);
    min-height: 48px;
    padding: var(--nx-space-2) 0;
    font-size: var(--nx-text-callout);
    & + .cm-setting {
      border-top: 1px solid var(--nx-border);
    }
    .el-switch,
    .el-input-number {
      flex: none;
    }
  }
  .cm-times {
    display: flex;
    align-items: flex-end;
    flex-wrap: wrap;
    gap: var(--nx-space-3);
  }
  .cm-times__arrow {
    padding-bottom: 32px;
    color: var(--nx-text-3);
  }
}

// Narrow screens: the dialog becomes a bottom sheet that slides up from the edge
@media (max-width: 600px) {
  .el-dialog__wrapper.cm-dialog {
    align-items: flex-end;
    padding: 0;

    .el-dialog.cm-sheet {
      width: 100%;
      max-width: 100%;
      max-height: 92vh;
      margin: 0;
      border-radius: var(--nx-radius-xl) var(--nx-radius-xl) 0 0;
    }
    .cm-sheet .el-dialog__footer {
      padding-bottom: calc(var(--nx-space-5) + env(safe-area-inset-bottom));
    }
    .cm-sheet .el-dialog__body {
      padding-left: var(--nx-space-4);
      padding-right: var(--nx-space-4);
    }
  }
  .dialog-fade-enter-active .el-dialog.cm-sheet {
    animation: cm-sheet-in var(--nx-dur-3) var(--nx-ease);
  }
  .dialog-fade-leave-active .el-dialog.cm-sheet {
    animation: cm-sheet-out var(--nx-dur-2) var(--nx-ease-in);
  }
}

@keyframes cm-sheet-in {
  from {
    transform: translateY(100%);
  }
  to {
    transform: none;
  }
}
@keyframes cm-sheet-out {
  from {
    transform: none;
  }
  to {
    transform: translateY(100%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .dialog-fade-enter-active .el-dialog.cm-sheet,
  .dialog-fade-leave-active .el-dialog.cm-sheet {
    animation: nx-dialog-in var(--nx-dur-2) linear;
  }
}
</style>
