import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const SetupState = sequelize.define('SetupState', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      defaultValue: 'singleton'
    },
    isComplete: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    completedSteps: {
      type: DataTypes.JSONB,
      defaultValue: []
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'setup_state',
    timestamps: false
  });

  return SetupState;
};
