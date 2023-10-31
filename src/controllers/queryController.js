import { OpenAI } from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';
import dotenv from 'dotenv';
dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
    environment: process.env.PINECONE_ENVIRONMENT
});
const pineconeIndex = pinecone.index("rag-chat");

async function embedQuery(query) {
    try {
        const parameters = {
            model: 'text-embedding-ada-002',
            input: query,
            encoding_format: 'float'
        };
        const resp = await openai.embeddings.create(parameters);
        return resp?.data[0]?.embedding;
    } catch (error) {
        console.error('Error embedding query:', error);
        throw error;
    }
}

async function queryPinecone(queryVector) {
    try {
        // Query Pinecone using the embedded query vector
        const results = await pineconeIndex.query({
            vector: queryVector,
            topK: 5, // Adjust the number of results as needed
            includeMetadata: true,
            includeValues: false
        });
        return results;
    } catch (error) {
        console.error('Error querying Pinecone:', error);
        throw error;
    }
}

const queryController = {
    async processQuery(req, res) {
        const { query } = req.body;
        if (!query) {
            return res.status(400).json({ success: false, message: "Query is required" });
        }

        try {
            // Embed the query using OpenAI
            const queryVector = await embedQuery(query);

            // Query Pinecone with the embedded query
            const results = await queryPinecone(queryVector);

            res.json({ success: true, results });
        } catch (error) {
            console.error('Error processing query:', error);
            res.status(500).json({ success: false, message: "Error processing query" });
        }
    }
};

export default queryController;
