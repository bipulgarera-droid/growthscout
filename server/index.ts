import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 5010;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static
const distPath = path.resolve(__dirname, '../dist');
const isProduction = fs.existsSync(distPath);
if (isProduction) {
    console.log('📦 Production mode: serving static files from dist/');
    app.use(express.static(distPath));
}

// Basic health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'GrowthScout Backend is running' });
});

// Import Routers
import pipelineRoutes from './routes/pipeline.js';
import slidesRoutes from './routes/slides.js';
import toolsRoutes from './routes/tools.js';
import leadsRoutes from './routes/leads.js';
import rankingsRoutes from './routes/rankings.js';
import outreachRoutes from './routes/outreach.js';
import fulfillmentRoutes from './routes/fulfillment.js';

// Mount Routers (paths were stripped of their prefix in the extractor script)
app.use('/api/pipeline', pipelineRoutes);
app.use('/api/slides', slidesRoutes);
app.use('/api', toolsRoutes); // discover, enrich, analyze, screenshot, chat
app.use('/api', leadsRoutes); // projects, leads
app.use('/api/rankings', rankingsRoutes);
app.use('/api', outreachRoutes); // projects, push-to-outreach
app.use('/', fulfillmentRoutes); // webhooks, r/:slug, reviews

// In non-production, root is just an info message
if (!isProduction) {
    app.get('/', (req, res) => {
        res.send(`<h1>🚀 GrowthScout API</h1><p>Server running. <a href="/api/slides/auth-url">Authenticate Slides</a></p>`);
    });
}

// SPA Catch-all (Must be last)
const distIndexPath = path.resolve(__dirname, '../dist/index.html');
if (fs.existsSync(distIndexPath)) {
    app.get('*', (req, res) => {
        res.sendFile(distIndexPath);
    });
}

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`OAuth callback: http://localhost:${PORT}/oauth2callback`);
});
