import { getModels } from '../models/index.js';

/**
 * Прилагательные в мужском роде (базовая форма).
 * Женский род образуется автоматически: -ый/-ий/-ой → -ая
 */
const ADJECTIVES = [
  'Ласковый', 'Добрый', 'Смелый', 'Мудрый', 'Весёлый',
  'Тёплый', 'Нежный', 'Яркий', 'Славный', 'Милый',
  'Бодрый', 'Верный', 'Храбрый', 'Чуткий', 'Дружный',
  'Светлый', 'Тихий', 'Быстрый', 'Ловкий', 'Пушистый',
  'Сонный', 'Забавный', 'Уютный', 'Солнечный', 'Звёздный',
  'Облачный', 'Снежный', 'Лунный', 'Радужный', 'Искристый',
  'Шустрый', 'Озорной', 'Мечтательный', 'Задумчивый', 'Кроткий',
  'Ясный', 'Вольный', 'Мирный', 'Цветочный', 'Ванильный',
  'Карамельный', 'Бархатный', 'Сказочный', 'Волшебный', 'Хрустальный',
  'Жемчужный', 'Изумрудный', 'Рубиновый', 'Золотой', 'Серебряный'
];

/**
 * Животные с указанием грамматического рода.
 * M — мужской, F — женский.
 */
const ANIMALS = [
  { name: 'Котёнок', gender: 'M' },
  { name: 'Пингвин', gender: 'M' },
  { name: 'Лисёнок', gender: 'M' },
  { name: 'Зайчонок', gender: 'M' },
  { name: 'Медвежонок', gender: 'M' },
  { name: 'Совёнок', gender: 'M' },
  { name: 'Ёжик', gender: 'M' },
  { name: 'Бельчонок', gender: 'M' },
  { name: 'Оленёнок', gender: 'M' },
  { name: 'Дельфин', gender: 'M' },
  { name: 'Панда', gender: 'F' },
  { name: 'Коала', gender: 'M' },
  { name: 'Хомячок', gender: 'M' },
  { name: 'Кролик', gender: 'M' },
  { name: 'Черепашка', gender: 'F' },
  { name: 'Попугай', gender: 'M' },
  { name: 'Утёнок', gender: 'M' },
  { name: 'Воробушек', gender: 'M' },
  { name: 'Филин', gender: 'M' },
  { name: 'Барсучок', gender: 'M' },
  { name: 'Тигрёнок', gender: 'M' },
  { name: 'Львёнок', gender: 'M' },
  { name: 'Жирафик', gender: 'M' },
  { name: 'Слонёнок', gender: 'M' },
  { name: 'Бегемотик', gender: 'M' },
  { name: 'Выдра', gender: 'F' },
  { name: 'Бобёр', gender: 'M' },
  { name: 'Енотик', gender: 'M' },
  { name: 'Хорёк', gender: 'M' },
  { name: 'Лемур', gender: 'M' },
  { name: 'Фламинго', gender: 'M' },
  { name: 'Колибри', gender: 'F' },
  { name: 'Снегирь', gender: 'M' },
  { name: 'Ласточка', gender: 'F' },
  { name: 'Журавлик', gender: 'M' },
  { name: 'Тюлень', gender: 'M' },
  { name: 'Моржонок', gender: 'M' },
  { name: 'Китёнок', gender: 'M' },
  { name: 'Капибара', gender: 'F' },
  { name: 'Шиншилла', gender: 'F' },
  { name: 'Альпака', gender: 'F' },
  { name: 'Горностай', gender: 'M' },
  { name: 'Песец', gender: 'M' },
  { name: 'Сурок', gender: 'M' },
  { name: 'Ленивец', gender: 'M' },
  { name: 'Носорожик', gender: 'M' },
  { name: 'Пони', gender: 'M' },
  { name: 'Росомаха', gender: 'F' },
  { name: 'Морской Конёк', gender: 'M' },
  { name: 'Косатка', gender: 'F' }
];

/**
 * Склоняет прилагательное (м.р.) в женский род.
 * Правило: -ый/-ий/-ой → -ая
 */
function toFeminine(adj) {
  if (adj.endsWith('ый')) return adj.slice(0, -2) + 'ая';
  if (adj.endsWith('ий')) return adj.slice(0, -2) + 'ая';
  if (adj.endsWith('ой')) return adj.slice(0, -2) + 'ая';
  return adj;
}

/**
 * Согласовать прилагательное с родом существительного.
 */
function agreeAdjective(adj, gender) {
  return gender === 'F' ? toFeminine(adj) : adj;
}

/**
 * Получить или создать анонимный псевдоним агента для тикета.
 */
export async function getOrCreateAlias(agentId, ticketId) {
  const { AgentAlias } = getModels();

  // Проверяем существующий
  const existing = await AgentAlias.findOne({
    where: { agentId, ticketId }
  });
  if (existing) return existing.alias;

  // Получаем уже использованные в этом тикете
  const used = await AgentAlias.findAll({
    where: { ticketId },
    attributes: ['alias']
  });
  const usedSet = new Set(used.map(a => a.alias));

  // Генерируем уникальный с учётом рода
  let alias;
  let attempts = 0;
  do {
    const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
    const agreedAdj = agreeAdjective(adj, animal.gender);
    alias = `${agreedAdj} ${animal.name}`;
    attempts++;
  } while (usedSet.has(alias) && attempts < 100);

  try {
    await AgentAlias.create({ agentId, ticketId, alias });
  } catch (err) {
    // Race condition: другой запрос уже создал — читаем
    if (err.name === 'SequelizeUniqueConstraintError') {
      const existing = await AgentAlias.findOne({ where: { agentId, ticketId } });
      return existing?.alias || alias;
    }
    throw err;
  }
  return alias;
}
