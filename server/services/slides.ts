import { google, slides_v1 } from 'googleapis';
import path from 'path';
import * as fs from 'fs';
import * as readline from 'readline';

// Scopes for Google Slides and Drive
const SCOPES = [
    'https://www.googleapis.com/auth/presentations',
    'https://www.googleapis.com/auth/drive',
];

const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');
const TOKEN_PATH = path.join(process.cwd(), 'token.json');

// OAuth2 Client Setup
const getOAuth2Client = async () => {
    if (!fs.existsSync(CREDENTIALS_PATH)) {
        throw new Error("Missing credentials.json. Please add your Google OAuth2 client credentials.");
    }

    const credentialsRaw = fs.readFileSync(CREDENTIALS_PATH, 'utf-8');
    const credentials = JSON.parse(credentialsRaw);
    const { client_id, client_secret } = credentials.web || credentials.installed;
    const redirect_uris = credentials.web?.redirect_uris || credentials.installed?.redirect_uris || ['http://localhost:3001/oauth2callback'];

    const oAuth2Client = new google.auth.OAuth2(
        client_id,
        client_secret,
        redirect_uris[0] || 'http://localhost:3001/oauth2callback'
    );

    // Check if we have a saved token
    if (fs.existsSync(TOKEN_PATH)) {
        const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
        oAuth2Client.setCredentials(token);
        return oAuth2Client;
    }

    // No token - need to authorize
    throw new Error('NOT_AUTHORIZED');
};

// Generate Auth URL for user consent
export const getAuthUrl = () => {
    if (!fs.existsSync(CREDENTIALS_PATH)) {
        return null;
    }
    const credentialsRaw = fs.readFileSync(CREDENTIALS_PATH, 'utf-8');
    const credentials = JSON.parse(credentialsRaw);
    const { client_id, client_secret } = credentials.web || credentials.installed;
    const redirect_uris = credentials.web?.redirect_uris || credentials.installed?.redirect_uris || ['http://localhost:3001/oauth2callback'];

    const oAuth2Client = new google.auth.OAuth2(
        client_id,
        client_secret,
        redirect_uris[0] || 'http://localhost:3001/oauth2callback'
    );

    return oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
    });
};

// Handle OAuth callback and save token
export const handleOAuthCallback = async (code: string) => {
    const credentialsRaw = fs.readFileSync(CREDENTIALS_PATH, 'utf-8');
    const credentials = JSON.parse(credentialsRaw);
    const { client_id, client_secret } = credentials.web || credentials.installed;
    const redirect_uris = credentials.web?.redirect_uris || credentials.installed?.redirect_uris || ['http://localhost:3001/oauth2callback'];

    const oAuth2Client = new google.auth.OAuth2(
        client_id,
        client_secret,
        redirect_uris[0] || 'http://localhost:3001/oauth2callback'
    );

    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);

    // Save token for future use
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
    console.log('Token saved to', TOKEN_PATH);

    return tokens;
};

// Check if authorized
export const isAuthorized = () => {
    return fs.existsSync(TOKEN_PATH);
};

export const createSlides = async (data: any) => {
    const auth = await getOAuth2Client();

    const slidesService = google.slides({ version: 'v1', auth });
    const driveService = google.drive({ version: 'v3', auth });

    const { businessName, screenshots, redesigns } = data;

    // 1. Create Presentation
    const presentation = await slidesService.presentations.create({
        requestBody: {
            title: `GrowthScout Proposal - ${businessName}`,
        },
    });
    const presentationId = presentation.data.presentationId!;
    console.log(`Created Presentation: ${presentationId}`);

    const requests: any[] = [];
    const slideIdGenerators = () => `slide_${Math.random().toString(36).substr(2, 9)}`;

    // Helper: Create Blank Slide
    const createSlide = (slideId: string) => ({
        createSlide: {
            objectId: slideId,
            slideLayoutReference: { predefinedLayout: 'BLANK' }
        }
    });

    // Helper: Add Text
    const addText = (slideId: string, text: string, fontSize: number, x: number, y: number, w: number, h: number, bold = false) => {
        const elementId = `${slideId}_txt_${Math.random().toString(36).substr(2, 5)}`;
        return [
            {
                createShape: {
                    objectId: elementId,
                    shapeType: 'TEXT_BOX',
                    elementProperties: {
                        pageObjectId: slideId,
                        size: { height: { magnitude: h, unit: 'PT' }, width: { magnitude: w, unit: 'PT' } },
                        transform: { scaleX: 1, scaleY: 1, translateX: x, translateY: y, unit: 'PT' }
                    }
                }
            },
            { insertText: { objectId: elementId, text } },
            {
                updateTextStyle: {
                    objectId: elementId,
                    style: { fontSize: { magnitude: fontSize, unit: 'PT' }, bold },
                    fields: 'fontSize,bold'
                }
            }
        ];
    };

    // Helper: Add Image
    const addImage = (slideId: string, url: string, x: number, y: number, w: number, h: number) => ({
        createImage: {
            objectId: `${slideId}_img_${Math.random().toString(36).substr(2, 5)}`,
            url: url, // Must be publicly accessible URL
            elementProperties: {
                pageObjectId: slideId,
                size: { height: { magnitude: h, unit: 'PT' }, width: { magnitude: w, unit: 'PT' } },
                transform: { scaleX: 1, scaleY: 1, translateX: x, translateY: y, unit: 'PT' }
            }
        }
    });

    // --- SLIDE 1: Title Slide ---
    const slide1 = slideIdGenerators();
    requests.push(createSlide(slide1));
    requests.push(...addText(slide1, `Proposal for ${businessName}`, 32, 50, 150, 600, 50, true));
    requests.push(...addText(slide1, "GrowthScout Audits", 18, 50, 220, 400, 30));

    // --- SLIDE 2: Current Status (Screenshots) ---
    if (screenshots) {
        const slide2 = slideIdGenerators();
        requests.push(createSlide(slide2));
        requests.push(...addText(slide2, "Current Website Analysis", 24, 30, 30, 500, 40, true));

        // Above Fold (Left)
        if (screenshots.aboveFold) {
            requests.push(addImage(slide2, screenshots.aboveFold, 30, 100, 320, 240));
            requests.push(...addText(slide2, "Above the Fold", 12, 30, 350, 200, 20));
        }

        // Below Fold (Right)
        if (screenshots.belowFold) {
            requests.push(addImage(slide2, screenshots.belowFold, 370, 100, 320, 240));
            requests.push(...addText(slide2, "Below the Fold", 12, 370, 350, 200, 20));
        }
    }

    // --- SLIDE 3 & 4: Redesigns ---
    if (redesigns && Array.isArray(redesigns)) {
        redesigns.forEach((redesignUrl, index) => {
            const slideId = slideIdGenerators();
            requests.push(createSlide(slideId));
            requests.push(...addText(slideId, `Proposed Redesign - Concept ${index + 1}`, 24, 30, 30, 500, 40, true));
            requests.push(addImage(slideId, redesignUrl, 20, 80, 680, 380)); // Full slide width mostly
        });
    }

    // Execute Batch Update
    if (requests.length > 0) {
        await slidesService.presentations.batchUpdate({
            presentationId,
            requestBody: { requests }
        });
    }

    // Make Public (Viewer) - Optional
    await driveService.permissions.create({
        fileId: presentationId,
        requestBody: {
            role: 'reader',
            type: 'anyone',
        }
    });

    return {
        presentationId,
        url: `https://docs.google.com/presentation/d/${presentationId}/edit`
    };
};
