import { api } from './api.js';
import config from '@/config.js';

/**
 * WebSocket клиент с автоматическим переподключением.
 */
export class WsClient {
  constructor(opts = {}) {
    this.opts = opts;
    this.ws = null;
    this.reconnectTimer = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.destroyed = false;
    this._typingTimer = null;
  }

  connect() {
    if (this.destroyed) return;

    const token = api.accessToken;
    if (!token) return;

    let url = `${config.wsUrl}?token=${token}`;
    if (this.opts.ticketId) {
      url += `&ticketId=${this.opts.ticketId}`;
    }

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      if (this.opts.onConnect) this.opts.onConnect();
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this._handleMessage(msg);
      } catch {
        // ignore
      }
    };

    this.ws.onclose = (event) => {
      if (this.opts.onDisconnect) this.opts.onDisconnect();
      if (!this.destroyed && event.code !== 4001) {
        this._scheduleReconnect();
      }
    };

    this.ws.onerror = () => {};
  }

  _handleMessage(msg) {
    switch (msg.type) {
      case 'message':
        if (this.opts.onMessage) this.opts.onMessage(msg.data);
        break;
      case 'typing':
        if (this.opts.onTyping) this.opts.onTyping(msg.data);
        break;
      case 'history':
        if (this.opts.onHistory) this.opts.onHistory(msg.data.messages);
        break;
      case 'status_changed':
        if (this.opts.onStatusChanged) this.opts.onStatusChanged(msg.data);
        break;
      case 'agent_changed':
        if (this.opts.onAgentChanged) this.opts.onAgentChanged(msg.data);
        break;
      case 'ticket_updated':
        if (this.opts.onTicketUpdated) this.opts.onTicketUpdated(msg.data);
        break;
      case 'tickets_updated':
        if (this.opts.onTicketsUpdated) this.opts.onTicketsUpdated();
        break;
      case 'profile_updated':
        if (this.opts.onProfileUpdated) this.opts.onProfileUpdated(msg.data);
        break;
      case 'force_logout':
        if (this.opts.onForceLogout) this.opts.onForceLogout();
        break;
      case 'notification':
        if (this.opts.onNotification) this.opts.onNotification(msg.data);
        break;
      case 'error':
        if (this.opts.onError) this.opts.onError(msg.data);
        break;
    }
  }

  sendMessage(content, attachmentIds = []) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: 'message', content, attachmentIds }));
  }

  sendTyping() {
    if (this._typingTimer) return;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'typing' }));
    }
    this._typingTimer = setTimeout(() => { this._typingTimer = null; }, 2000);
  }

  _scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => { this.connect(); }, delay);
  }

  destroy() {
    this.destroyed = true;
    clearTimeout(this.reconnectTimer);
    clearTimeout(this._typingTimer);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
