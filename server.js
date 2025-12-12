const express = require('express');
const vision = require('@google-cloud/vision');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();

// Use the port from Render or default to 3000
const port = process.env.PORT || 3000;

// 👉 Load credentials JSON safely from project folder
// Example: put your JSON in project root as "camera-ai-credentials.json"
const keyFilePath = path.join(__dirname, 'camera-ai-credentials.json');

// Ensure file exists
if (!fs.existsSync(keyFilePath)) {
    console.error('❌ Google Cloud key file not found at', keyFilePath);
    process.exit(1);
}

// Create Vision client
const client = new vision.ImageAnnotatorClient({
    keyFilename: keyFilePath
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Root route for sanity check
app.get('/', (req, res) => {
    res.send('✅ AI Image Analyzer Backend is running! Use POST /analyze-image to analyze images.');
});

// Endpoint to analyze image
app.post('/analyze-image', async (req, res) => {
    try {
        const { image } = req.body;

        if (!image) {
            return res.status(400).json({ error: 'No image provided' });
        }

        const request = {
            image: { content: image.split(',')[1] },
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

// Start server
app.listen(port, () => {
    console.log(`✅ Server running → http://localhost:${port}`);
    console.log(`🔐 Using credentials: ${keyFilePath}`);
});
