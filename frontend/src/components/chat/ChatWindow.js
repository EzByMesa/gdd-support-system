import { el, clearEl } from '../../utils/dom.js';
import { formatChatTime } from '../../utils/format.js';
import { WsClient } from '../../services/websocket.js';
import { Toast } from '../ui/Toast.js';

export class ChatWindow {
  /**
   * @param {object} opts
   * @param {string} opts.ticketId
   * @param {string} opts.currentUserId
   * @param {boolean} opts.readonly
   */
  constructor({ ticketId, currentUserId, readonly = false }) {
    this.ticketId = ticketId;
    this.currentUserId = currentUserId;
    this.readonly = readonly;
    this.messages = [];
    this.ws = null;
    this.typingText = '';
    this.typingClearTimer = null;

    this.el = el('div', { class: 'chat' });

    // Messages area
    this.messagesEl = el('div', { class: 'chat__messages' });

    // Typing
    this.typingEl = el('div', { class: 'chat__typing' });

    // Input area
    this.inputArea = el('div', { class: 'chat__input-area' });

    if (!readonly) {
      this.inputEl = el('textarea', {
        class: 'chat__input',
        placeholder: 'Введите сообщение...',
        rows: '1'
      });

      this.inputEl.addEventListener('input', () => {
        this._autoResize();
        if (this.ws) this.ws.sendTyping();
      });

      this.inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this._send();
        }
      });

      this.sendBtn = el('button', {
        class: 'chat__send-btn',
        onClick: () => this._send()
      }, '\u27A4');

      this.inputArea.appendChild(this.inputEl);
      this.inputArea.appendChild(this.sendBtn);
    } else {
      this.inputArea.appendChild(
        el('div', { class: 'text-muted text-sm', style: { padding: 'var(--space-sm)', textAlign: 'center', width: '100%' } },
          'Только чтение')
      );
    }

    this.el.appendChild(this.messagesEl);
    this.el.appendChild(this.typingEl);
    this.el.appendChild(this.inputArea);
  }

  /**
   * Подключение к WebSocket
   */
  connect() {
    this.ws = new WsClient({
      ticketId: this.ticketId,
      onHistory: (messages) => {
        this.messages = messages;
        this._renderMessages();
        this._scrollToBottom();
      },
      onMessage: (msg) => {
        this.messages.push(msg);
        this._appendMessage(msg);
        this._scrollToBottom();
      },
      onTyping: (data) => {
        this._showTyping(data.displayName);
      },
      onStatusChanged: (data) => {
        Toast.info(`Статус изменён: ${data.status}`);
      },
      onError: (data) => {
        Toast.error(data.message);
      }
    });

    this.ws.connect();
  }

  _send() {
    if (!this.inputEl) return;
    const content = this.inputEl.value.trim();
    if (!content) return;

    this.ws.sendMessage(content);
    this.inputEl.value = '';
    this._autoResize();
  }

  _renderMessages() {
    clearEl(this.messagesEl);
    for (const msg of this.messages) {
      this._appendMessage(msg);
    }
  }

  _appendMessage(msg) {
    const isOwn = msg.author.id === this.currentUserId;

    const msgEl = el('div', { class: `chat-message${isOwn ? ' chat-message--own' : ''}` });

    // Author name
    if (!isOwn) {
      const authorChildren = [msg.author.displayName];
      // Для агентов/админов — показываем псевдоним мелким шрифтом
      if (msg.author.alias) {
        authorChildren.push(
          el('span', {
            style: { fontWeight: 'normal', color: 'var(--color-text-muted)', fontStyle: 'italic', marginLeft: '6px' }
          }, `(для пользователя: ${msg.author.alias})`)
        );
      }
      const authorEl = el('div', { class: 'chat-message__author' }, authorChildren);
      msgEl.appendChild(authorEl);
    }

    // Bubble
    const bubble = el('div', { class: 'chat-message__bubble' });
    bubble.textContent = msg.content;
    msgEl.appendChild(bubble);

    // Attachments
    if (msg.attachments && msg.attachments.length > 0) {
      const attList = el('div', { class: 'flex-col gap-xs', style: { marginTop: 'var(--space-xs)' } });
      for (const att of msg.attachments) {
        attList.appendChild(
          el('a', {
            href: `/api/attachments/${att.id}/download`,
            target: '_blank',
            style: { fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)' }
          }, `\uD83D\uDCCE ${att.originalName}`)
        );
      }
      msgEl.appendChild(attList);
    }

    // Time
    msgEl.appendChild(
      el('div', { class: 'chat-message__time' }, formatChatTime(msg.createdAt))
    );

    this.messagesEl.appendChild(msgEl);
  }

  _showTyping(name) {
    this.typingEl.textContent = `${name} печатает...`;

    clearTimeout(this.typingClearTimer);
    this.typingClearTimer = setTimeout(() => {
      this.typingEl.textContent = '';
    }, 3000);
  }

  _scrollToBottom() {
    requestAnimationFrame(() => {
      this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    });
  }

  _autoResize() {
    if (!this.inputEl) return;
    this.inputEl.style.height = 'auto';
    this.inputEl.style.height = Math.min(this.inputEl.scrollHeight, 120) + 'px';
  }

  destroy() {
    if (this.ws) this.ws.destroy();
    clearTimeout(this.typingClearTimer);
  }

  mount(parent) {
    parent.appendChild(this.el);
    return this;
  }
}
