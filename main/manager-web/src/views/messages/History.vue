<template>
  <div class="tb-page hist">
    <TbPageHeader :title="$t('nav.history')" :description="$t('history.desc')" />

    <div v-if="!agentId && robot.loaded" class="hist__none">
      <TbEmpty face="confused" :title="$t('common.noRobot')" :text="$t('common.noRobotText')">
        <TbButton variant="primary" to="/robots" icon="robots">{{ $t('common.goRobots') }}</TbButton>
      </TbEmpty>
    </div>

    <ChatHistory v-else-if="agentId" :agent-id="agentId" :description="$t('history.sectionDesc')" />
  </div>
</template>

<script setup>
// History: what was said with the robot, for every product that keeps chat history (feature
// 'chat_history'), including those without Messages. TinyBot shows the same list inside Messages.
import { computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { loadRobots, robot } from '@/shell/robot';
import ChatHistory from './ChatHistory.vue';

const route = useRoute();
const agentId = computed(() => String((route.query && route.query.agentId) || robot.agentId || ''));
onMounted(() => { loadRobots(); });
</script>

<style>
.hist__none { padding: var(--tb-s10) 0; }
</style>
