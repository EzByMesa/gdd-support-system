/**
 * Утилиты совместимости между PostgreSQL и SQLite.
 */
import { Op } from 'sequelize';
import { getDialect } from '../models/index.js';

/**
 * Case-insensitive LIKE — iLike для Postgres, like для SQLite.
 */
export function iLike(value) {
  const dialect = getDialect();
  if (dialect === 'sqlite') {
    return { [Op.like]: value }; // SQLite LIKE уже case-insensitive для ASCII
  }
  return { [Op.iLike]: value };
}
