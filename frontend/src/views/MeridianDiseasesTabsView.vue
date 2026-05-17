<script setup lang="ts">
import { ref } from 'vue'
import MeridianDiseasesView from './MeridianDiseasesView.vue'
import ModernDiseasesView from './ModernDiseasesView.vue'

type SubTab = 'dong-y' | 'hien-dai'
const activeSub = ref<SubTab>('dong-y')
</script>

<template>
  <div class="diseases-tabs">
    <div class="sub-tab-bar">
      <button
        type="button"
        class="sub-tab-btn"
        :class="{ active: activeSub === 'dong-y' }"
        @click="activeSub = 'dong-y'"
      >
        Bệnh đông y
      </button>
      <button
        type="button"
        class="sub-tab-btn"
        :class="{ active: activeSub === 'hien-dai' }"
        @click="activeSub = 'hien-dai'"
      >
        Bệnh đông y hiện đại
      </button>
    </div>

    <KeepAlive>
      <MeridianDiseasesView v-if="activeSub === 'dong-y'" />
      <ModernDiseasesView v-else />
    </KeepAlive>
  </div>
</template>

<style scoped>
.diseases-tabs { width: 100%; }
.sub-tab-bar {
  display: flex;
  gap: 4px;
  padding: 4px;
  margin: var(--space-4) auto 0;
  max-width: 1400px;
  background: var(--white);
  border: 1px solid var(--brown-200);
  border-radius: var(--radius-lg);
  width: fit-content;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
}
.sub-tab-btn {
  padding: var(--space-2) var(--space-5);
  border-radius: var(--radius-md);
  border: none;
  background: transparent;
  font-weight: 600;
  font-size: var(--font-size-sm);
  color: var(--gray-600);
  cursor: pointer;
  transition: all var(--transition-base);
}
.sub-tab-btn:hover { color: var(--brown-700); }
.sub-tab-btn.active {
  background: var(--brown-600);
  color: var(--white);
  box-shadow: 0 2px 4px rgba(161, 98, 7, 0.2);
}
</style>
