import { Router } from 'express';
import { login, register, refresh, logout, me, getProviders } from '../controllers/authController.js';
import { loginOneC } from '../controllers/authOneCController.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// Public
router.post('/login', asyncHandler(login));
router.post('/register', asyncHandler(register));
router.post('/1c', asyncHandler(loginOneC));
router.post('/refresh', asyncHandler(refresh));
router.get('/providers', asyncHandler(getProviders));

// Protected
router.post('/logout', authenticate, asyncHandler(logout));
router.get('/me', authenticate, asyncHandler(me));

export default router;
