<template>
  <div class="rf" :class="{ 'has-error': !!error }">
    <label class="rf__label" :for="forId">{{ label }}</label>
    <div class="rf__line">
      <slot />
      <div v-if="$slots.aside" class="rf__aside"><slot name="aside" /></div>
    </div>
    <p v-if="error" :id="`${forId}-err`" class="rf__error" role="alert">{{ error }}</p>
  </div>
</template>

<script setup>
// One ruled line of the sign-in forms: the label, then the field written on the rule, as on a
// printed form. The rule turns blue while the field has focus and red with an error under it.
defineProps({
  label: { type: String, required: true },
  forId: { type: String, required: true },
  error: { type: String, default: '' },
});
</script>

<style>
.auth-form { display: grid; border-top: var(--tb-rule-band) solid var(--tb-rule); }
.rf { display: grid; gap: 2px; padding: 10px 0 0; border-bottom: 1px solid var(--tb-rule-soft);
  transition: box-shadow var(--tb-t-hover) var(--tb-ease); }
.rf:focus-within { border-bottom-color: var(--tb-focus); box-shadow: inset 0 -1px 0 var(--tb-focus); }
.rf.has-error { border-bottom-color: var(--tb-danger); box-shadow: inset 0 -1px 0 var(--tb-danger); }
.rf__label { font-size: var(--tb-fs-13); font-weight: 600; color: var(--tb-ink-2); }
.rf__line { display: flex; align-items: center; gap: 8px; min-width: 0; }
.rf__line > .tb-input { flex: 1; min-width: 0; }
.rf__aside { flex: none; display: flex; align-items: center; padding-bottom: 4px; }
.rf__error { font-size: var(--tb-fs-13); font-weight: 500; color: var(--tb-danger); padding-bottom: 8px; }

/* the field sits on the rule: no box, no radius, the row's rule is its underline */
.rf .tb-input { --h: 46px; border: 0; border-radius: 0; padding: 0 0 0 0; background: transparent; box-shadow: none; }
.rf .tb-input:focus-within { box-shadow: none; }
.rf .tb-select { flex: none; }
.rf .tb-select select { border: 0; border-radius: 0; background: transparent; min-height: 46px; padding: 0 30px 0 0; box-shadow: none; }
.rf .tb-select select:focus-visible { box-shadow: none; text-decoration: underline; text-underline-offset: 4px; }
.rf .tb-select__chev { right: 4px; }
.rf__sep { flex: none; width: 1px; height: 24px; background: var(--tb-rule-soft); }

.auth-form__links { display: flex; justify-content: space-between; align-items: center; gap: 8px 16px; flex-wrap: wrap; padding: 12px 0 4px; }
.auth-form__link {
  display: inline-flex; align-items: center; gap: 4px; min-height: 44px; padding: 0; border: 0; background: none;
  font-weight: 600; font-size: var(--tb-fs-14); color: var(--tb-ink); text-decoration: underline;
  text-decoration-color: var(--tb-rule-soft); text-underline-offset: 4px;
  transition: text-decoration-color var(--tb-t-hover) var(--tb-ease);
}
.auth-form__link:hover { text-decoration-color: currentColor; }
.auth-form__submit { margin-top: 18px; }
.auth-form__alert { display: flex; gap: 8px; align-items: flex-start; margin-top: 14px; color: var(--tb-danger); font-weight: 500; font-size: var(--tb-fs-14); }
.auth-form__alert .tb-icon { flex: none; margin-top: 2px; }
.auth-form__note { margin-top: 14px; font-size: var(--tb-fs-13); color: var(--tb-ink-2); }
.auth-form__note a { color: var(--tb-ink); font-weight: 600; }
.auth-form__method { margin-bottom: 14px; }

/* the picture code: the server's image, tap for a new one */
.captcha-btn {
  display: grid; place-items: center; width: 112px; height: 40px; padding: 0; overflow: hidden;
  border: 1px solid var(--tb-rule-soft); border-radius: var(--tb-radius-s); background: var(--tb-paper); color: var(--tb-ink-2);
  transition: border-color var(--tb-t-hover) var(--tb-ease);
}
.captcha-btn:hover { border-color: var(--tb-ink); }
.captcha-btn img { width: 100%; height: 100%; object-fit: contain; }
.captcha-btn.is-text { background: transparent; font-size: var(--tb-fs-12); font-weight: 600; gap: 2px; padding: 0 6px; line-height: 1.2; text-align: center; }
</style>
