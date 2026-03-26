<template>
  <v-card class="mb-2 ticket-card-hover" color="surface-light" rounded="xl" style="cursor: pointer" @click="$emit('click')">
    <div class="d-flex align-center pa-3 pa-sm-4" style="gap: 12px">
      <!-- Avatar (staff view) -->
      <RoleAvatar v-if="showAuthor && ticket.author" :size="36"
        :name="ticket.author.displayName" :src="ticket.author.avatarPath" role="USER" />

      <!-- Number -->
      <span class="text-caption font-weight-bold" style="color: rgba(255,255,255,0.3); min-width: 32px">#{{ ticket.number }}</span>

      <!-- Content -->
      <div style="flex: 1; min-width: 0">
        <div class="text-body-2 font-weight-medium text-truncate">{{ ticket.title }}</div>

        <!-- Description preview -->
        <div v-if="ticket.description" class="text-caption text-truncate mt-1"
          style="color: rgba(255,255,255,0.3); max-width: 100%">
          {{ ticket.description }}
        </div>

        <div class="d-flex align-center flex-wrap mt-1" style="gap: 4px">
          <v-chip :color="statusColor(ticket.status)" size="x-small" label>
            {{ formatStatus(ticket.status) }}
          </v-chip>
          <v-chip :color="priorityColor(ticket.priority)" size="x-small" label variant="tonal">
            {{ formatPriority(ticket.priority) }}
          </v-chip>
          <span v-if="showAuthor && ticket.author" class="text-caption" style="color: rgba(255,255,255,0.45)">
            <v-icon size="10" class="mr-1">mdi-account</v-icon>{{ ticket.author.displayName }}
          </span>
          <span class="text-caption" style="color: rgba(255,255,255,0.25)">
            {{ formatShortDate(ticket.createdAt) }}
          </span>
          <span v-if="ticket.assignee" class="text-caption" style="color: rgba(255,255,255,0.25)">
            &rarr; {{ ticket.assignee.displayName }}
          </span>
        </div>
      </div>

      <!-- Unread badge -->
      <v-badge v-if="ticket.unreadCount > 0" :content="ticket.unreadCount" color="primary" inline>
        <v-icon size="18" color="primary">mdi-chat</v-icon>
      </v-badge>
      <v-icon v-else size="16" style="opacity: 0.15">mdi-chevron-right</v-icon>
    </div>
  </v-card>
</template>

<script setup>
import { formatStatus, formatPriority } from '@/utils/format.js';
import RoleAvatar from '@/components/ui/RoleAvatar.vue';

defineProps({
  ticket: { type: Object, required: true },
  showAuthor: { type: Boolean, default: false }
});

defineEmits(['click']);

const STATUS_COLORS = { OPEN: 'info', IN_PROGRESS: 'warning', WAITING_FOR_USER: 'orange', RESOLVED: 'success', CLOSED: 'grey' };
const PRIORITY_COLORS = { LOW: 'grey', MEDIUM: 'info', HIGH: 'warning', CRITICAL: 'error' };
function statusColor(s) { return STATUS_COLORS[s] || 'grey'; }
function priorityColor(p) { return PRIORITY_COLORS[p] || 'grey'; }

function formatShortDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  const now = new Date();
  if (dt.toDateString() === now.toDateString()) {
    return dt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }
  return dt.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}
</script>
