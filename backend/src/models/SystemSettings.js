import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const SystemSettings = sequelize.define('SystemSettings', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    key: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false
    },
    value: {
      type: DataTypes.JSONB
    }
  }, {
    tableName: 'system_settings',
    createdAt: false,
    updatedAt: true
  });

  return SystemSettings;
};
