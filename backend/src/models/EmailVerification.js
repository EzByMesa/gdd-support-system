import { DataTypes } from 'sequelize';

/**
 * Верификация email через код подтверждения.
 */
export default (sequelize) => {
  const EmailVerification = sequelize.define('EmailVerification', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false
    },
    code: {
      type: DataTypes.STRING(6),
      allowNull: false
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false
    },
    verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  }, {
    tableName: 'email_verifications',
    timestamps: true
  });

  EmailVerification.associate = (models) => {
    EmailVerification.belongsTo(models.User, { foreignKey: 'userId', onDelete: 'CASCADE' });
  };

  return EmailVerification;
};
