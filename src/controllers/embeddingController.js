import { OpenAI } from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';
import dotenv from 'dotenv';
import axios from 'axios';
import cheerio from 'cheerio';

dotenv.config();

const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
    environment: process.env.PINECONE_ENVIRONMENT
})
const pineconeIndex = pinecone.index("rag-chat");

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

async function fetchWebPageContent(url) {
    try {
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);
        const textContent = $('body').text();
        return textContent;
    } catch (error) {
        console.error("Error fetching webpage: ", error);
    }
}

function splitContentIntoChunks(content) {
    // Split by double newline, which often separates paragraphs or sections
    let rawChunks = content.split('\n\n');

    let chunks = [];
    let currentChunk = '';

    rawChunks.forEach(rawChunk => {
        if (currentChunk.split(' ').length + rawChunk.split(' ').length <= 4096) {
            currentChunk += '\n\n' + rawChunk;
        } else {
            chunks.push(currentChunk.trim());
            currentChunk = rawChunk;
        }
    });

    if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim());
    }

    return chunks;
}

async function insertIntoPinecone(vectors) {
    let insertBatches = [];

    while (vectors.length) {
        let batchedVectors = vectors.splice(0, 250); // Split into chunks of 250

        // Insert the batchedVectors into Pinecone
        try {
            let pineconeResult = await pineconeIndex.upsert(batchedVectors);
            insertBatches.push(pineconeResult); // Add the result to insertBatches
        } catch (error) {
            throw new Error('Error inserting into Pinecone: ' + error.message); // Re-throw the error
        }
    }

    return insertBatches; // Return the results of the insertions
}

const embeddingController = {
    async processAndInsertContent(req, res) {
        const { url } = req.body;
        if (!url) {
            return res.status(400).json({ success: false, message: "URL is required" });
        }

        try {
            // Fetch content from the URL
            const content = await fetchWebPageContent(url);

            // Split content into chunks
            const chunks = splitContentIntoChunks(content);

            // Get embeddings from content
            let embeddings = [];

            for (let chunk of chunks) {
                const parameters = {
                    model: 'text-embedding-ada-002',
                    input: chunk,
                    encoding_format: 'float'
                };
                const resp = await openai.embeddings.create(parameters);
                console.log("API Response Keys:", Object.keys(resp));
                const embedding = resp?.data[0]?.embedding;
                embeddings.push(embedding);
            }

            // Structure the data for Pinecone insertion
            let vectors = chunks.map((chunk, i) => {
                return {
                    id: `chunk-${i}`,
                    metadata: { content: chunk, sourceUrl: url },
                    values: embeddings[i]
                };
            });

            // Insert embeddings into Pinecone
            const insertBatches = await insertIntoPinecone(vectors);

            res.json({ success: true, message: "Content processed and inserted successfully", insertBatches });
        } catch (error) {
            console.error('Error processing and inserting content:', error);
            res.status(500).json({ success: false, message: "Error processing and inserting content" });
        }
    }
};

export default embeddingController;