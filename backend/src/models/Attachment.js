import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const Attachment = sequelize.define('Attachment', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    originalName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    storedName: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false
    },
    mimeType: {
      type: DataTypes.STRING,
      allowNull: false
    },
    size: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    encryptionIV: {
      type: DataTypes.STRING,
      allowNull: false
    }
  }, {
    tableName: 'attachments',
    timestamps: true,
    updatedAt: false,
    indexes: [
      { fields: ['ticketId'] },
      { fields: ['messageId'] }
    ]
  });

  Attachment.associate = (models) => {
    Attachment.belongsTo(models.Ticket, { foreignKey: 'ticketId', onDelete: 'CASCADE' });
    Attachment.belongsTo(models.TicketMessage, { foreignKey: 'messageId', onDelete: 'CASCADE' });
    Attachment.belongsTo(models.User, { as: 'uploadedBy', foreignKey: { name: 'uploadedById', allowNull: true } });
  };

  return Attachment;
};
