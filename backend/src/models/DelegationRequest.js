import { DataTypes } from 'sequelize';
import { DelegationStatus } from './enums.js';

export default (sequelize) => {
  const DelegationRequest = sequelize.define('DelegationRequest', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    status: {
      type: DataTypes.ENUM(...Object.values(DelegationStatus)),
      defaultValue: DelegationStatus.PENDING
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    respondedAt: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'delegation_requests',
    timestamps: true,
    updatedAt: false,
    indexes: [
      { fields: ['ticketId'] },
      { fields: ['toAgentId'] },
      { fields: ['status'] }
    ]
  });

  DelegationRequest.associate = (models) => {
    DelegationRequest.belongsTo(models.Ticket, { foreignKey: 'ticketId' });
    DelegationRequest.belongsTo(models.User, { as: 'fromAgent', foreignKey: 'fromAgentId' });
    DelegationRequest.belongsTo(models.User, { as: 'toAgent', foreignKey: 'toAgentId' });
  };

  return DelegationRequest;
};
