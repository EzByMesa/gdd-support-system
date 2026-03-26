import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const TicketMessage = sequelize.define('TicketMessage', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    isSystem: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  }, {
    tableName: 'ticket_messages',
    timestamps: true,
    updatedAt: false,
    indexes: [
      { fields: ['ticketId'] }
    ]
  });

  TicketMessage.associate = (models) => {
    TicketMessage.belongsTo(models.Ticket, { foreignKey: 'ticketId', onDelete: 'CASCADE' });
    TicketMessage.belongsTo(models.User, { as: 'author', foreignKey: { name: 'authorId', allowNull: true } });
    TicketMessage.hasMany(models.Attachment, { foreignKey: 'messageId' });
  };

  return TicketMessage;
};
