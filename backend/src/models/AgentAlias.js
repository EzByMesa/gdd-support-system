import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const AgentAlias = sequelize.define('AgentAlias', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    alias: {
      type: DataTypes.STRING,
      allowNull: false
    }
  }, {
    tableName: 'agent_aliases',
    timestamps: true,
    updatedAt: false,
    indexes: [
      { fields: ['agentId', 'ticketId'], unique: true }
    ]
  });

  AgentAlias.associate = (models) => {
    AgentAlias.belongsTo(models.User, { as: 'agent', foreignKey: 'agentId' });
    AgentAlias.belongsTo(models.Ticket, { foreignKey: 'ticketId' });
  };

  return AgentAlias;
};
