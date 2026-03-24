import { DataTypes } from 'sequelize';

/**
 * Пользовательские настройки уведомлений.
 * Матрица: [trigger] x [channel] = enabled/disabled
 *
 * trigger: NEW_MESSAGE, STATUS_CHANGED, TICKET_ASSIGNED, DELEGATION_REQUEST,
 *          DELEGATION_ACCEPTED, DELEGATION_REJECTED, AGENT_CHANGED
 * channel: app, push, email
 */
export default (sequelize) => {
  const NotificationPreference = sequelize.define('NotificationPreference', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    trigger: {
      type: DataTypes.STRING,
      allowNull: false
    },
    channelApp: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    channelPush: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    channelEmail: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  }, {
    tableName: 'notification_preferences',
    timestamps: true,
    indexes: [
      { unique: true, fields: ['userId', 'trigger'] }
    ]
  });

  NotificationPreference.associate = (models) => {
    NotificationPreference.belongsTo(models.User, { foreignKey: 'userId', onDelete: 'CASCADE' });
  };

  return NotificationPreference;
};
