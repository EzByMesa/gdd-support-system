import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const CustomField = sequelize.define('CustomField', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    fieldKey: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    type: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'text',
      validate: {
        isIn: [['text', 'textarea', 'number', 'select', 'date', 'checkbox']]
      }
    },
    required: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    defaultValue: {
      type: DataTypes.STRING,
      allowNull: true
    },
    options: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: null
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    tableName: 'custom_fields',
    timestamps: true,
    indexes: [
      { fields: ['sortOrder'] },
      { fields: ['isActive'] }
    ]
  });

  return CustomField;
};
