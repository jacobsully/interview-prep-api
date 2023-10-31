import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import embeddingRoutes from './routes/embeddingRoutes.js';
import queryRoutes from './routes/queryRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use('/embed-content', embeddingRoutes);
app.use('/get-answer', queryRoutes);

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
