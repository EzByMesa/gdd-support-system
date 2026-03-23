import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const PushSubscription = sequelize.define('PushSubscription', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    endpoint: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    keys: {
      type: DataTypes.JSONB,
      allowNull: false
    }
  }, {
    tableName: 'push_subscriptions',
    timestamps: true,
    updatedAt: false,
    indexes: [
      { fields: ['userId'] }
    ]
  });

  PushSubscription.associate = (models) => {
    PushSubscription.belongsTo(models.User, { foreignKey: 'userId', onDelete: 'CASCADE' });
  };

  return PushSubscription;
};
