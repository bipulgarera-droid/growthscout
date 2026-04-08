import { Router } from 'express';


const router = Router();
import { supabase } from '../supabaseClient.js';

import { bulkSaveBusinesses, updateBusinessField, saveBusiness, getProjects, createProject } from '../services/persistence.js';

// Get Projects
router.get('/api/projects', async (req, res) => {
    try {
        const projects = await getProjects();
        res.json({ success: true, projects });
    } catch (error: any) {
        console.error("Fetch Projects Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// Create Project
router.post('/api/projects', async (req, res) => {
    try {
        const { name, description } = req.body;
        if (!name) return res.status(400).json({ error: 'Project name is required' });

        const project = await createProject(name);
        res.json({ success: true, project });
    } catch (error: any) {
        console.error("Create Project Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// Bulk sync businesses to Supabase
router.post('/api/leads/sync', async (req, res) => {
    try {
        const { businesses } = req.body;
        if (!businesses || !Array.isArray(businesses)) {
            return res.status(400).json({ error: 'businesses array required' });
        }

        console.log(`[API] Syncing ${businesses.length} businesses to Supabase...`);
        const result = await bulkSaveBusinesses(businesses);
        res.json({ success: true, ...result });
    } catch (error: any) {
        console.error("Sync Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// Save single business
router.post('/api/leads/save', async (req, res) => {
    try {
        const { business } = req.body;
        if (!business) {
            return res.status(400).json({ error: 'business object required' });
        }

        const success = await saveBusiness(business);
        res.json({ success });
    } catch (error: any) {
        console.error("Save Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// Update a single lead field
router.patch('/api/leads/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const success = await updateBusinessField(id, updates);
        res.json({ success });
    } catch (error: any) {
        console.error("Update Error:", error);
        res.status(500).json({ error: error.message });
    }
});

router.post('/api/leads/:id/upload-logo', async (req, res) => {
    try {
        const leadId = req.params.id;
        const { logoUrl, logoData } = req.body;

        let finalUrl = logoUrl;

        // If local file data is provided as base64, buffer it and pipe to Supabase storage
        if (logoData && logoData.startsWith('data:image')) {
            const matches = logoData.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
            if (!matches || matches.length !== 3) {
                return res.status(400).json({ error: 'Invalid Base64 image format' });
            }
            
            const [ , ext, base64String ] = matches;
            const buffer = Buffer.from(base64String, 'base64');
            const filename = `logo-${leadId}-${Date.now()}.${ext}`;

            // Ensure bucket exists (best-effort, usually created in Dashboard)
            await supabase.storage.createBucket('logos', { public: true }).catch(() => {});

            // Upload directly to Supabase Storage
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('logos')
                .upload(filename, buffer, { 
                    contentType: `image/${ext}`,
                    upsert: true
                });

            if (uploadError) {
                console.error("Storage upload error:", uploadError);
                throw new Error("Failed to upload image to Supabase storage.");
            }

            // Retrieve the public URL
            const { data: publicUrlData } = supabase.storage.from('logos').getPublicUrl(filename);
            finalUrl = publicUrlData.publicUrl;
        }

        if (!finalUrl) {
            return res.status(400).json({ error: 'Either logoUrl or logoData is required' });
        }

        // Update local Supabase leads table
        const { error: dbError } = await supabase
            .from('leads')
            .update({ logo_url: finalUrl })
            .eq('id', leadId);

        if (dbError) throw dbError;

        res.json({ success: true, logoUrl: finalUrl, message: 'Logo URL updated successfully. Re-generate website to apply.' });
    } catch (error: any) {
        console.error('Logo Upload Error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
