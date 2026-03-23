import { DataTypes } from 'sequelize';
import { AuthProviderType } from './enums.js';

export default (sequelize) => {
  const AuthProvider = sequelize.define('AuthProvider', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    type: {
      type: DataTypes.ENUM(...Object.values(AuthProviderType)),
      allowNull: false
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    config: {
      type: DataTypes.JSONB,
      defaultValue: {}
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    tableName: 'auth_providers',
    timestamps: true
  });

  return AuthProvider;
};
