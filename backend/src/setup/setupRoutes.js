import { Router } from 'express';
import {
  getSetupStatus,
  stepDatabase,
  stepAdmin,
  stepStorage,
  stepComplete
} from './setupController.js';

const router = Router();

router.get('/status', getSetupStatus);
router.post('/step/database', stepDatabase);
router.post('/step/admin', stepAdmin);
router.post('/step/storage', stepStorage);
router.post('/step/complete', stepComplete);

export default router;
