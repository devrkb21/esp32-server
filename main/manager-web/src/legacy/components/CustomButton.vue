<template>
  <el-button
    :class="['custom-button', `custom-button--${type}`]"
    :type="elType"
    :plain="type === 'delete'"
    v-bind="$attrs"
    @click="$emit('click', $event)"
  >
    <slot />
  </el-button>
</template>

<script>
export default {
  name: 'CustomButton',
  props: {
    // default = secondary (neutral fill); confirm / add = primary (accent); delete = danger (soft)
    type: {
      type: String,
      default: 'default',
      validator: (val) => ['default', 'confirm', 'delete', 'add'].includes(val)
    }
  },
  computed: {
    elType() {
      if (this.type === 'confirm' || this.type === 'add') return 'primary';
      if (this.type === 'delete') return 'danger';
      return undefined;
    }
  }
};
</script>

<style lang="scss" scoped>
// Look comes from the Nobix Element UI styles (styles/nobix/element.scss)
.custom-button {
  width: fit-content;
}
.custom-button--add ::v-deep [class*="el-icon-"] {
  font-weight: 700;
}
</style>
