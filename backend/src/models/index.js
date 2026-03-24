import { Sequelize } from 'sequelize';
import UserModel from './User.js';
import TicketModel from './Ticket.js';
import TicketMessageModel from './TicketMessage.js';
import AttachmentModel from './Attachment.js';
import TopicGroupModel from './TopicGroup.js';
import AgentAliasModel from './AgentAlias.js';
import DelegationRequestModel from './DelegationRequest.js';
import PushSubscriptionModel from './PushSubscription.js';
import NotificationModel from './Notification.js';
import AuthProviderModel from './AuthProvider.js';
import SystemSettingsModel from './SystemSettings.js';
import SetupStateModel from './SetupState.js';
import CustomFieldModel from './CustomField.js';
import NotificationPreferenceModel from './NotificationPreference.js';
import EmailVerificationModel from './EmailVerification.js';

let sequelize = null;
let models = {};
let currentDialect = null;

/**
 * Инициализация БД — поддерживает PostgreSQL и SQLite.
 *
 * @param {string} connectionString - для postgres: postgres://..., для sqlite: путь к файлу
 * @param {object} opts - { dialect: 'postgres' | 'sqlite' }
 */
export function initDatabase(connectionString, opts = {}) {
  let dialect = opts.dialect;

  // Автоопределение диалекта
  if (!dialect) {
    dialect = connectionString.startsWith('postgres') ? 'postgres' : 'sqlite';
  }

  currentDialect = dialect;

  if (dialect === 'sqlite') {
    sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: connectionString,
      logging: false
    });
  } else {
    sequelize = new Sequelize(connectionString, {
      logging: false,
      dialect: 'postgres'
    });
  }

  models = {
    User: UserModel(sequelize),
    Ticket: TicketModel(sequelize),
    TicketMessage: TicketMessageModel(sequelize),
    Attachment: AttachmentModel(sequelize),
    TopicGroup: TopicGroupModel(sequelize),
    AgentAlias: AgentAliasModel(sequelize),
    DelegationRequest: DelegationRequestModel(sequelize),
    PushSubscription: PushSubscriptionModel(sequelize),
    Notification: NotificationModel(sequelize),
    AuthProvider: AuthProviderModel(sequelize),
    SystemSettings: SystemSettingsModel(sequelize),
    SetupState: SetupStateModel(sequelize),
    CustomField: CustomFieldModel(sequelize),
    NotificationPreference: NotificationPreferenceModel(sequelize),
    EmailVerification: EmailVerificationModel(sequelize)
  };

  // Установить связи
  Object.values(models).forEach(model => {
    if (model.associate) model.associate(models);
  });

  return { sequelize, models };
}

export function getSequelize() {
  return sequelize;
}

export function getModels() {
  return models;
}

export function getDialect() {
  return currentDialect;
}
