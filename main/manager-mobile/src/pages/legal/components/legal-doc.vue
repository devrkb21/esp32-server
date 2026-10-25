<script setup lang="ts">
import type { LegalBlock } from '../texts'
import { computed } from 'vue'
import { getCurrentLanguage, t } from '@/i18n'
import { withContact } from '@/pages/login/authKit.mjs'
import { LEGAL_TEXTS } from '../texts'

// One of Nobix's legal documents in the reading layout, Bangla or English by the app language.
const props = defineProps<{ name: 'terms' | 'privacy' }>()
const doc = computed(() => LEGAL_TEXTS[props.name][getCurrentLanguage() === 'bn' ? 'bn' : 'en'])
const titleKey = computed(() => (props.name === 'privacy' ? 'mauth.privacyTitle' : 'mauth.termsTitle'))
const shown = (s: string) => withContact(s) as string
const lines = (b: LegalBlock) => (b.type === 'list' ? b.items : [b])
</script>

<template>
  <view class="tb-wrap legal">
    <tb-page-header :title="t(titleKey)" back />
    <view class="legal__doc">
      <view class="legal__head">
        <text class="legal__title">
          {{ doc.title }}
        </text>
        <text class="legal__date">
          {{ doc.effective }}
        </text>
      </view>
      <view v-for="(b, i) in doc.intro" :key="`i${i}`" class="legal__para">
        <text class="legal__p">
          {{ shown(b.type === 'p' ? b.text : '') }}
        </text>
      </view>
      <view v-for="(s, si) in doc.sections" :key="si" class="legal__section">
        <view class="legal__h">
          <text class="legal__htext">
            {{ s.heading }}
          </text>
        </view>
        <block v-for="(b, bi) in s.blocks" :key="bi">
          <view v-for="(line, li) in lines(b)" :key="li" :class="b.type === 'list' ? 'legal__item' : 'legal__para'">
            <text v-if="b.type === 'list'" class="legal__mark" aria-hidden="true" />
            <text class="legal__p">
              <text v-if="line.lead" class="legal__lead">{{ `${line.lead} ` }}</text>{{ shown(line.text) }}
            </text>
          </view>
        </block>
      </view>
      <!-- The maker's logo closes the document (owner decision 3): never recoloured; the dark file on dark ground. -->
      <view class="legal__brand">
        <image class="legal__logo legal__logo--light" src="/static/brand/nobix-lockup.png" mode="widthFix" :aria-label="t('brand.nobix')" role="img" />
        <image class="legal__logo legal__logo--dark" src="/static/brand/nobix-lockup-dark.png" mode="widthFix" :aria-label="t('brand.nobix')" role="img" />
      </view>
    </view>
  </view>
</template>

<style lang="scss">
/* The reading layout of the legal pages: a 65ch measure, ruled headings, bold lead-ins */
.legal {
  padding-bottom: calc(40px + env(safe-area-inset-bottom));
}
.legal__doc {
  max-width: 65ch;
  margin: 0 auto;
  padding-top: 18px;
}
.legal__head {
  padding-bottom: 12px;
  margin-bottom: 14px;
  border-bottom: 3px solid var(--tb-rule);
}
.legal__title {
  display: block;
  font-family: var(--tb-font-display);
  font-weight: 700;
  font-size: 20px;
  line-height: 1.25;
}
.legal__date {
  display: block;
  margin-top: 6px;
  font-size: 13px;
  color: var(--tb-ink-2);
}
.legal__h {
  margin: 24px 0 10px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--tb-rule);
}
.legal__htext {
  font-family: var(--tb-font-display);
  font-weight: 700;
  font-size: 17px;
  line-height: 1.35;
  color: var(--tb-ink);
}
.legal__p {
  font-size: 15px;
  line-height: 1.7;
  color: var(--tb-ink);
}
.legal__lead {
  font-weight: 700;
}
.legal__para {
  margin-bottom: 12px;
}
.legal__item {
  display: flex;
  gap: 10px;
  margin: 0 0 8px;
}
.legal__brand {
  display: flex;
  justify-content: center;
  margin-top: 32px;
  padding: 24px 0 8px;
  border-top: 1px solid var(--tb-rule);
}
.legal__logo {
  width: 120px;
  height: auto;
}
.legal__logo--dark {
  display: none;
}
.is-dark .legal__logo--light {
  display: none;
}
.is-dark .legal__logo--dark {
  display: block;
}
.legal__mark {
  flex: none;
  width: 5px;
  height: 5px;
  margin-top: 11px;
  background: var(--tb-ink-3);
}
</style>
