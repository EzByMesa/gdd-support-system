import { DataTypes } from 'sequelize';
import { TicketStatus, TicketPriority } from './enums.js';

export default (sequelize) => {
  const Ticket = sequelize.define('Ticket', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    number: {
      type: DataTypes.INTEGER,
      unique: true
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM(...Object.values(TicketStatus)),
      defaultValue: TicketStatus.OPEN
    },
    priority: {
      type: DataTypes.ENUM(...Object.values(TicketPriority)),
      defaultValue: TicketPriority.MEDIUM
    },
    closedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    closedReason: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    customFields: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: null
    },
    createdById: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'ID агента/админа, создавшего тикет от имени пользователя'
    }
  }, {
    tableName: 'tickets',
    timestamps: true,
    hooks: {
      beforeCreate: async (ticket) => {
        if (!ticket.number) {
          const max = await Ticket.max('number') || 0;
          ticket.number = max + 1;
        }
      }
    },
    indexes: [
      { fields: ['status'] },
      { fields: ['authorId'] },
      { fields: ['assigneeId'] },
      { fields: ['topicGroupId'] }
    ]
  });

  Ticket.associate = (models) => {
    Ticket.belongsTo(models.User, { as: 'author', foreignKey: { name: 'authorId', allowNull: true } });
    Ticket.belongsTo(models.User, { as: 'assignee', foreignKey: { name: 'assigneeId', allowNull: true } });
    Ticket.belongsTo(models.User, { as: 'createdBy', foreignKey: { name: 'createdById', allowNull: true } });
    Ticket.belongsTo(models.TopicGroup, { foreignKey: 'topicGroupId' });
    Ticket.hasMany(models.TicketMessage, { foreignKey: 'ticketId' });
    Ticket.hasMany(models.Attachment, { foreignKey: 'ticketId' });
    Ticket.hasMany(models.AgentAlias, { foreignKey: 'ticketId' });
    Ticket.hasMany(models.DelegationRequest, { foreignKey: 'ticketId' });
  };

  return Ticket;
};
