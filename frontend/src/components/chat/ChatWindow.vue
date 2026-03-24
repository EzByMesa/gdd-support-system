<template>
  <div class="chat-container">
    <!-- Messages -->
    <div ref="messagesEl" class="chat__messages">
      <div v-if="messages.length === 0" class="text-center py-10">
        <v-icon size="48" color="grey-lighten-1" class="mb-2">mdi-chat-outline</v-icon>
        <div class="text-body-2 text-medium-emphasis">Нет сообщений</div>
      </div>

      <div v-for="msg in messages" :key="msg.id || msg.createdAt"
        :class="['chat-message', { 'chat-message--own': msg.author.id === currentUserId }]">
        <!-- Author -->
        <div v-if="msg.author.id !== currentUserId" class="chat-message__author">
          {{ msg.author.displayName }}
          <span v-if="msg.author.alias"
            style="font-weight: normal; font-style: italic; opacity: 0.6; margin-left: 4px; font-size: 0.65rem">
            ({{ msg.author.alias }})
          </span>
        </div>

        <!-- Bubble -->
        <div class="chat-message__bubble">{{ msg.content }}</div>

        <!-- Attachments -->
        <div v-if="msg.attachments?.length" class="d-flex flex-column mt-1" style="gap: 2px">
          <a v-for="att in msg.attachments" :key="att.id"
            :href="`/api/attachments/${att.id}/download`" target="_blank"
            class="text-primary text-decoration-none"
            style="font-size: 0.75rem; display: flex; align-items: center; gap: 4px">
            <v-icon size="14">mdi-paperclip</v-icon>
            {{ att.originalName }}
          </a>
        </div>

        <!-- Time -->
        <div class="chat-message__time">{{ formatChatTime(msg.createdAt) }}</div>
      </div>
    </div>

    <!-- Typing -->
    <div v-if="typingText" class="px-4 py-1" style="font-size: 0.75rem; color: rgba(0,0,0,0.4)">
      <v-icon size="14" class="mr-1">mdi-dots-horizontal</v-icon>
      {{ typingText }}
    </div>

    <!-- Input -->
    <div class="chat-input-area">
      <template v-if="!isReadonly">
        <textarea ref="inputEl" placeholder="Введите сообщение..." rows="1"
          @input="onInput" @keydown="onKeyDown"></textarea>
        <button class="chat-send-btn" @click="send" title="Отправить">
          <v-icon size="20">mdi-send</v-icon>
        </button>
      </template>
      <div v-else class="text-center w-100 py-2">
        <v-chip color="grey" variant="tonal" prepend-icon="mdi-lock">
          Только чтение
        </v-chip>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { WsClient } from '@/services/websocket.js';
import { api } from '@/services/api.js';
import { formatChatTime } from '@/utils/format.js';
import { toast } from '@/composables/useToast.js';

const props = defineProps({
  ticketId: { type: String, required: true },
  currentUserId: { type: String, required: true },
  readonly: { type: Boolean, default: false }
});

const isReadonly = ref(props.readonly);
const messages = ref([]);
const typingText = ref('');
const messagesEl = ref(null);
const inputEl = ref(null);

let ws = null;
let typingClearTimer = null;

function scrollToBottom() {
  nextTick(() => {
    if (messagesEl.value) {
      messagesEl.value.scrollTop = messagesEl.value.scrollHeight;
    }
  });
}

async function loadHistoryViaApi() {
  try {
    const res = await api.get(`/tickets/${props.ticketId}/messages`, { limit: 50 });
    messages.value = res.data || [];
    scrollToBottom();
  } catch {
    toast.error('Не удалось загрузить историю чата');
  }
}

function connect() {
  ws = new WsClient({
    ticketId: props.ticketId,
    onHistory: (msgs) => { messages.value = msgs; scrollToBottom(); },
    onMessage: (msg) => { messages.value.push(msg); scrollToBottom(); },
    onTyping: (data) => {
      typingText.value = `${data.displayName} печатает...`;
      clearTimeout(typingClearTimer);
      typingClearTimer = setTimeout(() => { typingText.value = ''; }, 3000);
    },
    onStatusChanged: (data) => {
      toast.info(`Статус изменён: ${data.status}`);
      if (data.status === 'CLOSED' || data.status === 'RESOLVED') {
        isReadonly.value = true;
        if (ws) { ws.destroy(); ws = null; }
      }
    },
    onError: (data) => { toast.error(data.message); }
  });
  ws.connect();
}

function send() {
  if (!inputEl.value) return;
  const content = inputEl.value.value.trim();
  if (!content) return;
  ws.sendMessage(content);
  inputEl.value.value = '';
  autoResize();
}

function onInput() {
  autoResize();
  if (ws) ws.sendTyping();
}

function onKeyDown(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
}

function autoResize() {
  if (!inputEl.value) return;
  inputEl.value.style.height = 'auto';
  inputEl.value.style.height = Math.min(inputEl.value.scrollHeight, 120) + 'px';
}

watch(() => props.readonly, (val) => {
  if (val && !isReadonly.value) {
    isReadonly.value = true;
    if (ws) { ws.destroy(); ws = null; }
  }
});

onMounted(() => {
  if (isReadonly.value) loadHistoryViaApi();
  else connect();
});

onUnmounted(() => {
  if (ws) ws.destroy();
  clearTimeout(typingClearTimer);
});
</script>
