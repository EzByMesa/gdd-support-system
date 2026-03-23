import { v4 as uuidv4 } from 'uuid';
import { getModels } from '../models/index.js';
import { encryptAndStore, decryptFile, deleteStoredFile } from '../services/encryption.js';
import { Role } from '../models/enums.js';

/**
 * POST /api/attachments
 * Upload — multipart/form-data, field: "file", optional: "ticketId", "messageId"
 */
export async function uploadAttachment(req, res) {
  if (!req.file) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Файл не предоставлен' }
    });
  }

  const { ticketId, messageId } = req.body;
  const { Attachment } = getModels();

  const storedName = uuidv4(); // без расширения!
  const { encryptionIV } = await encryptAndStore(req.file.buffer, storedName);

  const attachment = await Attachment.create({
    originalName: req.file.originalname,
    storedName,
    mimeType: req.file.mimetype,
    size: req.file.size,
    encryptionIV,
    ticketId: ticketId || null,
    messageId: messageId || null,
    uploadedById: req.user.sub
  });

  res.status(201).json({
    data: {
      id: attachment.id,
      originalName: attachment.originalName,
      mimeType: attachment.mimeType,
      size: attachment.size,
      createdAt: attachment.createdAt
    }
  });
}

/**
 * GET /api/attachments/:id
 */
export async function getAttachment(req, res) {
  const { Attachment } = getModels();

  const attachment = await Attachment.findByPk(req.params.id);
  if (!attachment) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Файл не найден' }
    });
  }

  res.json({
    data: {
      id: attachment.id,
      originalName: attachment.originalName,
      mimeType: attachment.mimeType,
      size: attachment.size,
      createdAt: attachment.createdAt
    }
  });
}

/**
 * GET /api/attachments/:id/download
 */
export async function downloadAttachment(req, res) {
  const { Attachment } = getModels();

  const attachment = await Attachment.findByPk(req.params.id);
  if (!attachment) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Файл не найден' }
    });
  }

  try {
    const decrypted = await decryptFile(attachment.storedName, attachment.encryptionIV);

    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(attachment.originalName)}"`);
    res.setHeader('Content-Length', decrypted.length);
    res.send(decrypted);
  } catch (err) {
    res.status(500).json({
      error: { code: 'DECRYPTION_ERROR', message: 'Ошибка расшифровки файла' }
    });
  }
}

/**
 * DELETE /api/attachments/:id
 */
export async function deleteAttachment(req, res) {
  const { Attachment } = getModels();

  const attachment = await Attachment.findByPk(req.params.id);
  if (!attachment) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Файл не найден' }
    });
  }

  // Только загрузивший или админ
  if (req.user.role !== Role.ADMIN && attachment.uploadedById !== req.user.sub) {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Нет прав на удаление' }
    });
  }

  await deleteStoredFile(attachment.storedName);
  await attachment.destroy();

  res.status(204).send();
}
