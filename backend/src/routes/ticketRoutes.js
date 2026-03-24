import { Router } from 'express';
import multer from 'multer';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  createTicket, listTickets, getTicket, updateTicket,
  updateStatus, assignTicket, updatePriority, closeTicket
} from '../controllers/ticketController.js';
import {
  uploadAttachment, getAttachment, downloadAttachment, deleteAttachment
} from '../controllers/attachmentController.js';
import { listMessages } from '../controllers/messageController.js';
import { createDelegation } from '../controllers/delegationController.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getModels } from '../models/index.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50 MB
});

// --- Custom Fields (public, for ticket creation form) ---
router.get('/custom-fields', authenticate, asyncHandler(async (req, res) => {
  const { CustomField } = getModels();
  const fields = await CustomField.findAll({
    where: { isActive: true },
    order: [['sortOrder', 'ASC']],
    attributes: ['id', 'name', 'fieldKey', 'type', 'required', 'defaultValue', 'options', 'sortOrder']
  });
  res.json({ data: fields });
}));

// --- Tickets ---
router.post('/', authenticate, asyncHandler(createTicket));
router.get('/', authenticate, asyncHandler(listTickets));
router.get('/:id', authenticate, asyncHandler(getTicket));
router.put('/:id', authenticate, asyncHandler(updateTicket));
router.put('/:id/status', authenticate, authorize('AGENT', 'ADMIN'), asyncHandler(updateStatus));
router.put('/:id/assign', authenticate, authorize('AGENT', 'ADMIN'), asyncHandler(assignTicket));
router.put('/:id/priority', authenticate, authorize('AGENT', 'ADMIN'), asyncHandler(updatePriority));
router.put('/:id/close', authenticate, asyncHandler(closeTicket));

// --- Messages ---
router.get('/:id/messages', authenticate, asyncHandler(listMessages));

// --- Delegation ---
router.post('/:id/delegate', authenticate, authorize('AGENT', 'ADMIN'), asyncHandler(createDelegation));

export default router;

// --- Attachments (отдельный роутер) ---
export const attachmentRouter = Router();

attachmentRouter.post('/', authenticate, upload.single('file'), asyncHandler(uploadAttachment));
attachmentRouter.get('/:id', authenticate, asyncHandler(getAttachment));
attachmentRouter.get('/:id/download', authenticate, asyncHandler(downloadAttachment));
attachmentRouter.delete('/:id', authenticate, asyncHandler(deleteAttachment));
