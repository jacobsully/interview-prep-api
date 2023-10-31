import express from 'express';
import embeddingController from '../controllers/embeddingController.js';

const router = express.Router();

router.post('/', embeddingController.processAndInsertContent);

export default router;
