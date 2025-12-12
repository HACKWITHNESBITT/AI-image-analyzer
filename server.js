const express = require('express');
const vision = require('@google-cloud/vision');
const cors = require('cors');
const path = require('path');

const app = express();
const port = 3000;

// 👉 FULL path to your JSON file
const keyFilePath = path.join(
    process.env.HOME,
    'Downloads',
    'camera-ai-project-f99b8f046008.json'
);

// 👉 Create a Vision client with credentials
const client = new vision.ImageAnnotatorClient({
    keyFilename: keyFilePath
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Endpoint to analyze image
app.post('/analyze-image', async (req, res) => {
    try {
        const { image } = req.body;

        if (!image) {
            return res.status(400).json({ error: 'No image provided' });
        }

        const request = {
            image: {
                content: image.split(',')[1]
            },
            features: [
                { type: 'OBJECT_LOCALIZATION' },
                { type: 'LABEL_DETECTION' }
            ]
        };

        const [result] = await client.annotateImage(request);

        const objects = result.localizedObjectAnnotations || [];
        const labels = result.labelAnnotations || [];

        const analysis = {
            objects: objects.map(obj => ({
                name: obj.name,
                confidence: obj.score,
                boundingBox: obj.boundingPoly?.normalizedVertices || []
            })),
            labels: labels.map(label => ({
                description: label.description,
                confidence: label.score
            }))
        };

        res.json(analysis);

    } catch (error) {
        console.error('🔥 Error analyzing image:', error);
        res.status(500).json({ error: 'Failed to analyze image', details: error.message });
    }
});

app.listen(port, () => {
    console.log(`✅ Server running → http://localhost:${port}`);
    console.log(`🔐 Using credentials: ${keyFilePath}`);
});
