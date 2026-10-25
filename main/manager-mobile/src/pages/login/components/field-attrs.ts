import type { Directive } from 'vue'

// The keyboard and autofill hints of the account forms' number fields (owner: m-auth).
// tb-input only knows the uni types and does not pass `type="tel"`, `inputmode` or `autocomplete`
// to its inner input, so on H5 this directive writes them onto that input once it exists. A phone
// number stays a string: type=number would drop the leading 0 of "01...", show spinners and
// ignore maxlength. Elsewhere (native app) there is no DOM; the uni number keypad is used there.

type FieldAttrs = Record<string, string>

let digitsType: 'text' | 'number' = 'number'
// #ifdef H5
digitsType = 'text'
// #endif
/** The tb-input type for a phone number or a one-time code */
export const DIGITS_TYPE = digitsType

function apply(el: any, attrs: FieldAttrs | undefined) {
  const input = el && typeof el.querySelector === 'function' ? el.querySelector('input') : null
  if (!input || !attrs)
    return
  Object.keys(attrs).forEach((name) => {
    if (input.getAttribute(name) !== attrs[name])
      input.setAttribute(name, attrs[name])
  })
}

export const vFieldAttrs: Directive<any, FieldAttrs> = {
  mounted: (el, binding) => apply(el, binding.value),
  updated: (el, binding) => apply(el, binding.value),
}

export const PHONE_ATTRS: FieldAttrs = { type: 'tel', inputmode: 'tel', autocomplete: 'tel' }
export const CODE_ATTRS: FieldAttrs = { type: 'text', inputmode: 'numeric', autocomplete: 'one-time-code' }
