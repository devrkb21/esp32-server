<template>
  <span v-if="isValid" class="nx-mac" tabindex="0" :aria-label="macAddress">{{ prefix }}<span class="nx-mac__mask" aria-hidden="true">{{ middle }}</span>{{ suffix }}</span>
  <span v-else class="nx-mac-text">{{ macAddress }}</span>
</template>

<script>
// Shows a MAC address with the middle bytes blurred; hover or keyboard focus reveals it.
export default {
  props: {
    macAddress: {
      type: String,
      default: '',
    },
  },
  computed: {
    isValid() {
      return /^(?:[0-9A-Z]{2}[:-]){5}[0-9A-Z]{2}$/i.test(this.macAddress);
    },
    segments() {
      return this.macAddress.split(/[:-]/);
    },
    separator() {
      return this.macAddress.indexOf('-') !== -1 ? '-' : ':';
    },
    prefix() {
      return this.segments.slice(0, 2).join(this.separator);
    },
    middle() {
      return this.separator + this.segments.slice(2, 4).join(this.separator) + this.separator;
    },
    suffix() {
      return this.segments.slice(4).join(this.separator);
    },
  },
};
</script>

<style lang="scss" scoped>
.nx-mac {
  display: inline-block;
  font-family: var(--nx-font-mono);
  font-size: 0.92em;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0;
  white-space: nowrap;
  border-radius: var(--nx-radius-sm);
  outline-offset: 2px;

  &:hover .nx-mac__mask,
  &:focus .nx-mac__mask {
    filter: none;
  }
}

.nx-mac__mask {
  filter: blur(4px);
  transition: filter var(--nx-dur-2) var(--nx-ease);
}

.nx-mac-text {
  overflow-wrap: anywhere;
}

@media (prefers-reduced-motion: reduce) {
  .nx-mac__mask {
    transition: none;
  }
}
</style>
