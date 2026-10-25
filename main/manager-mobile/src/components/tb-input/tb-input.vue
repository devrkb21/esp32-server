<script setup lang="ts">
import { ref } from 'vue'
import { t } from '@/i18n'

const props = withDefaults(defineProps<{
  modelValue?: string | number
  type?: 'text' | 'number' | 'digit' | 'idcard' | 'password'
  placeholder?: string
  size?: 'm' | 'l'
  icon?: string
  maxlength?: number
  disabled?: boolean
  invalid?: boolean
  clearable?: boolean
  confirmType?: 'send' | 'search' | 'next' | 'go' | 'done'
  ariaLabel?: string
  ariaDescribedby?: string
}>(), { modelValue: '', type: 'text', placeholder: '', size: 'm', icon: '', maxlength: 140, disabled: false, invalid: false, clearable: false, confirmType: 'done', ariaLabel: '', ariaDescribedby: '' })
const emit = defineEmits<{ (e: 'update:modelValue', v: string): void, (e: 'confirm', v: string): void, (e: 'blur'): void }>()
const reveal = ref(false)
function onInput(e: any) { emit('update:modelValue', e.detail.value) }
function clear() { emit('update:modelValue', '') }
function toggleReveal() { reveal.value = !reveal.value }
</script>

<template>
  <view class="tb-input" :class="[`tb-input--${size}`, { 'is-invalid': invalid, 'is-disabled': disabled }]">
    <tb-icon v-if="icon" class="tb-input__icon" :name="icon" :size="18" />
    <input class="tb-input__el" :value="String(modelValue ?? '')" :type="type === 'password' ? 'text' : type"
      :password="type === 'password' && !reveal" :placeholder="placeholder" placeholder-class="tb-input__ph"
      :maxlength="maxlength" :disabled="disabled" :confirm-type="confirmType" :aria-label="ariaLabel || undefined"
      :aria-invalid="invalid ? 'true' : undefined" :aria-describedby="ariaDescribedby || undefined"
      @input="onInput" @confirm="emit('confirm', String(modelValue ?? ''))" @blur="emit('blur')">
    <view v-if="clearable && modelValue && !disabled" class="tb-input__btn" role="button" tabindex="0" :aria-label="t('common.clear')"
      @click="clear" @keydown.enter="clear" @keydown.space.prevent="clear">
      <tb-icon name="close" :size="16" />
    </view>
    <view v-if="type === 'password'" class="tb-input__btn" role="button" tabindex="0"
      :aria-label="reveal ? t('common.hidePassword') : t('common.showPassword')"
      @click="toggleReveal" @keydown.enter="toggleReveal" @keydown.space.prevent="toggleReveal">
      <tb-icon :name="reveal ? 'eye-off' : 'eye'" :size="18" />
    </view>
  </view>
</template>

<style lang="scss">
.tb-input {
  --h: 46px;
  display: flex; align-items: center; gap: 4px; min-height: var(--h); padding: 0 6px 0 12px;
  background: var(--tb-paper); border: 1.5px solid var(--tb-ink); border-radius: var(--tb-radius-m);
}
.tb-input--l { --h: 52px; }
.tb-input.is-invalid { border-color: var(--tb-danger); }
.tb-input.is-disabled { opacity: .5; }
.tb-input__el { flex: 1; min-width: 0; height: calc(var(--h) - 4px); font-size: 16px; color: var(--tb-ink); background: transparent; }
.tb-input__ph { color: var(--tb-ink-3); }
.tb-input__icon { color: var(--tb-ink-2); }
.tb-input__btn { display: flex; flex: none; align-items: center; justify-content: center; width: 44px; height: 44px; margin-right: -6px; border-radius: 8px; color: var(--tb-ink-2); outline: none; }
.tb-input__btn:focus-visible { outline: 2px solid var(--tb-focus); outline-offset: 2px; }
</style>
