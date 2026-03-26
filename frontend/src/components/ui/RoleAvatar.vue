<template>
  <div class="role-avatar" :style="{ width: size + 'px', height: size + 'px' }">
    <!-- Crown for ADMIN -->
    <svg v-if="role === 'ADMIN'" class="role-avatar__crown" :width="size * 0.7" :height="size * 0.35"
      :style="{ top: -(size * 0.22) + 'px' }"
      viewBox="0 0 28 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 12L5 4L9.5 8L14 2L18.5 8L23 4L26 12H2Z" fill="#FFD700" stroke="#DAA520" stroke-width="1"/>
      <circle cx="2" cy="12" r="1.2" fill="#FFD700"/>
      <circle cx="26" cy="12" r="1.2" fill="#FFD700"/>
      <circle cx="14" cy="2" r="1.2" fill="#FFD700"/>
      <circle cx="5" cy="4" r="1.2" fill="#FFD700"/>
      <circle cx="23" cy="4" r="1.2" fill="#FFD700"/>
    </svg>

    <!-- Headset for AGENT -->
    <svg v-if="role === 'AGENT' || role === 'SENIOR_AGENT'" class="role-avatar__headset"
      :width="size + 8" :height="size + 8"
      :style="{ top: '-4px', left: '-4px' }"
      :viewBox="`0 0 ${size + 8} ${size + 8}`"
      fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <mask :id="'avatar-mask-' + uid">
          <rect width="100%" height="100%" fill="white"/>
        </mask>
      </defs>
      <!-- Headband arc -->
      <path :d="headbandPath" stroke="#8B9BC3" stroke-width="2" stroke-linecap="round" fill="none"/>
      <!-- Left earpiece -->
      <rect :x="2" :y="cy - 5" width="4" height="10" rx="2" fill="#8B9BC3"/>
      <!-- Right earpiece -->
      <rect :x="size + 2" :y="cy - 5" width="4" height="10" rx="2" fill="#8B9BC3"/>
      <!-- Mic boom -->
      <path :d="micPath" stroke="#8B9BC3" stroke-width="1.5" stroke-linecap="round" fill="none"/>
      <!-- Mic head -->
      <circle :cx="size * 0.7 + 4" :cy="size + 2" r="2.5" fill="#8B9BC3"/>
    </svg>

    <!-- Avatar -->
    <v-avatar :size="size" :color="avatarColor" style="position: relative; z-index: 2">
      <v-img v-if="src" :src="src" />
      <span v-else class="text-white font-weight-bold" :style="{ fontSize: (size * 0.4) + 'px' }">
        {{ initials }}
      </span>
    </v-avatar>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  role: { type: String, default: 'USER' },
  name: { type: String, default: '' },
  src: { type: String, default: '' },
  size: { type: Number, default: 36 }
});

let _uid = 0;
const uid = _uid++;

const initials = computed(() => {
  if (!props.name) return '?';
  const parts = props.name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : props.name[0].toUpperCase();
});

const avatarColor = computed(() => {
  if (props.role === 'ADMIN') return '#5C4D8A';
  if (props.role === 'SENIOR_AGENT') return '#2E6B4F';
  if (props.role === 'AGENT') return '#3D5A80';
  return '#555';
});

const cy = computed(() => props.size / 2 + 4);

const headbandPath = computed(() => {
  const s = props.size;
  const r = s / 2 + 4;
  const cx = s / 2 + 4;
  const topY = 4;
  return `M 4 ${cy.value - 3} Q ${cx} ${topY} ${s + 4} ${cy.value - 3}`;
});

const micPath = computed(() => {
  const s = props.size;
  const earY = cy.value + 5;
  const micX = s * 0.7 + 4;
  const micY = s + 2;
  return `M ${s + 2} ${earY} Q ${s + 4} ${micY + 2} ${micX} ${micY}`;
});
</script>

<style scoped>
.role-avatar {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.role-avatar__crown {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1;
  filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));
}

.role-avatar__headset {
  position: absolute;
  z-index: 1;
  pointer-events: none;
}
</style>
