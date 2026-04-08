import { Router } from 'express';


const router = Router();

import { createSlides, getAuthUrl, handleOAuthCallback, isAuthorized } from '../services/slides.js';

// Check if Google Slides is authorized
router.get('/api/slides/auth-status', (req, res) => {
    res.json({ authorized: isAuthorized() });
});

// Get Google OAuth URL for user authorization
router.get('/api/slides/auth-url', (req, res) => {
    const url = getAuthUrl();
    if (!url) {
        res.status(500).json({ error: 'Missing credentials.json' });
        return;
    }
    res.json({ authUrl: url });
});

// OAuth2 callback endpoint
router.get('/oauth2callback', async (req, res) => {
    const { code } = req.query;
    if (!code || typeof code !== 'string') {
        res.status(400).send('Missing authorization code');
        return;
    }
    try {
        await handleOAuthCallback(code);
        res.send('<html><body><h1>✅ Authorization successful!</h1><p>You can close this window and return to the app.</p><script>window.close();</script></body></html>');
    } catch (error: any) {
        res.status(500).send(`Authorization failed: ${error.message}`);
    }
});

// Create slides (requires authorization)
router.post('/api/slides', async (req, res) => {
    try {
        const result = await createSlides(req.body);
        res.json(result);
    } catch (error: any) {
        if (error.message === 'NOT_AUTHORIZED') {
            const authUrl = getAuthUrl();
            res.status(401).json({
                error: 'Google Slides not authorized',
                authUrl,
                needsAuth: true
            });
            return;
        }
        console.error(error);
        res.status(500).json({ error: error.message || "Failed to create slides" });
    }
});

export default router;
