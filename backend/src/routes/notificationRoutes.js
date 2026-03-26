import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  listNotifications, countUnread, markRead, markAllRead,
  deleteNotification, deleteAllNotifications,
  vapidKey, pushSubscribe, pushUnsubscribe
} from '../controllers/notificationController.js';

const router = Router();

router.get('/', authenticate, listNotifications);
router.get('/count', authenticate, countUnread);
router.put('/read-all', authenticate, markAllRead);
router.put('/:id/read', authenticate, markRead);
router.delete('/all', authenticate, deleteAllNotifications);
router.delete('/:id', authenticate, deleteNotification);

export default router;

// Push routes
export const pushRouter = Router();

pushRouter.get('/vapid-key', authenticate, vapidKey);
pushRouter.post('/subscribe', authenticate, pushSubscribe);
pushRouter.delete('/subscribe', authenticate, pushUnsubscribe);
