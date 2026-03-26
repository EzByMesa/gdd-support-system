import { DataTypes } from 'sequelize';
import { Role, AuthProviderType } from './enums.js';

export default (sequelize) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    email: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: true
    },
    login: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false
    },
    passwordHash: {
      type: DataTypes.STRING,
      allowNull: true
    },
    displayName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    role: {
      type: DataTypes.ENUM(...Object.values(Role)),
      defaultValue: Role.USER
    },
    isRootAdmin: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    authProvider: {
      type: DataTypes.ENUM(...Object.values(AuthProviderType)),
      defaultValue: AuthProviderType.LOCAL
    },
    externalId: {
      type: DataTypes.STRING,
      allowNull: true
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    verifiedEmail: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null
    },
    avatarPath: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null
    }
  }, {
    tableName: 'users',
    timestamps: true
  });

  User.associate = (models) => {
    User.hasMany(models.Ticket, { as: 'tickets', foreignKey: 'authorId' });
    User.hasMany(models.Ticket, { as: 'assignedTickets', foreignKey: 'assigneeId' });
    User.hasMany(models.TicketMessage, { foreignKey: 'authorId' });
    User.hasMany(models.Attachment, { foreignKey: 'uploadedById' });
    User.hasMany(models.AgentAlias, { foreignKey: 'agentId' });
    User.hasMany(models.PushSubscription, { foreignKey: 'userId' });
    User.hasMany(models.Notification, { foreignKey: 'userId' });
    User.hasMany(models.NotificationPreference, { foreignKey: 'userId' });
    User.hasMany(models.EmailVerification, { foreignKey: 'userId' });
  };

  return User;
};
