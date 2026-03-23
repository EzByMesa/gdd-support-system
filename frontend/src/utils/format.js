/**
 * Форматирование даты
 */
export function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

/**
 * Форматирование даты с временем
 */
export function formatDateTime(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Время для чата (сегодня — только время, иначе дата + время)
 */
export function formatChatTime(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }

  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Размер файла
 */
export function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

/**
 * Статус тикета на русском
 */
const STATUS_LABELS = {
  OPEN: 'Открыт',
  IN_PROGRESS: 'В работе',
  WAITING_FOR_USER: 'Ожидает ответа',
  RESOLVED: 'Решён',
  CLOSED: 'Закрыт'
};

export function formatStatus(status) {
  return STATUS_LABELS[status] || status;
}

/**
 * CSS-класс статуса для badge
 */
const STATUS_CLASSES = {
  OPEN: 'open',
  IN_PROGRESS: 'in-progress',
  WAITING_FOR_USER: 'waiting',
  RESOLVED: 'resolved',
  CLOSED: 'closed'
};

export function statusClass(status) {
  return STATUS_CLASSES[status] || 'closed';
}

/**
 * Приоритет на русском
 */
const PRIORITY_LABELS = {
  LOW: 'Низкий',
  MEDIUM: 'Средний',
  HIGH: 'Высокий',
  CRITICAL: 'Критичный'
};

export function formatPriority(priority) {
  return PRIORITY_LABELS[priority] || priority;
}

export function priorityClass(priority) {
  return (priority || 'medium').toLowerCase();
}
