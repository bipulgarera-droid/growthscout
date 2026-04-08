import { Router } from 'express';
import { supabase } from '../supabaseClient.js';

const router = Router();

import { searchRankings } from '../services/rankTracker.js';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

router.post('/api/rankings/search', async (req, res) => {
    try {
        const { keyword, city, maxResults } = req.body;
        if (!keyword || !city) {
            return res.status(400).json({ error: 'keyword and city are required' });
        }

        const result = await searchRankings(keyword, city, maxResults || 100);
        res.json(result);
    } catch (error: any) {
        console.error('Rank Tracker Error:', error);
        res.status(500).json({ error: error.message });
    }
});

router.post('/api/rankings/save', async (req, res) => {
    try {
        const { keyword, city, results } = req.body;
        if (!keyword || !city || !results || !Array.isArray(results)) {
            return res.status(400).json({ error: 'keyword, city, and results array required' });
        }

        // Map frontend shapes to the DB columns
        const rows = results.map((r: any) => ({
            keyword: keyword.trim().toLowerCase(),
            city: city.trim().toLowerCase(),
            rank: r.rank,
            name: r.name,
            address: r.address,
            phone: r.phone,
            website: r.website,
            rating: r.rating,
            review_count: r.reviewCount,
            category: r.category,
            place_id: r.placeId,
            image_url: r.imageUrl,
            is_claimed: r.isClaimed,
            added_to_pipeline: false
        }));

        // Use upsert to prevent duplicates if user clicks search multiple times
        const { error } = await supabase
            .from('ranked_leads')
            .upsert(rows, { onConflict: 'keyword,city,name' }) // Ensure this conflict behavior works or just insert 
            // Actually rank/name is safer, but standard insert is fine for now
            // Let's just do a clean insert but delete previous ones for this keyword+city first to avoid massive dupes
            ;

        // Better approach: Delete old search for this exact keyword+city, then insert fresh
        await supabase
            .from('ranked_leads')
            .delete()
            .match({ keyword: keyword.trim().toLowerCase(), city: city.trim().toLowerCase() });

        const { data, error: insertError } = await supabase
            .from('ranked_leads')
            .insert(rows)
            .select();

        if (insertError) throw insertError;

        res.json({ success: true, count: data?.length || 0 });
    } catch (error: any) {
        console.error('Rank Tracker Save Error:', error);
        res.status(500).json({ error: error.message });
    }
});

router.get('/api/rankings/history', async (req, res) => {
    try {
        const { keyword, city } = req.query;
        if (!keyword || !city) {
            return res.status(400).json({ error: 'keyword and city required' });
        }

        const { data, error } = await supabase
            .from('ranked_leads')
            .select('*')
            .eq('keyword', (keyword as string).trim().toLowerCase())
            .eq('city', (city as string).trim().toLowerCase())
            .order('rank', { ascending: true });

        if (error) throw error;

        // Map back to camelCase for frontend
        const results = (data || []).map(r => ({
            id: r.id, // Supabase UUID
            rank: r.rank,
            name: r.name,
            address: r.address,
            phone: r.phone,
            website: r.website,
            rating: r.rating,
            reviewCount: r.review_count,
            category: r.category,
            placeId: r.place_id,
            imageUrl: r.image_url,
            isClaimed: r.is_claimed,
            addedToPipeline: r.added_to_pipeline
        }));

        res.json({ results });
    } catch (error: any) {
        console.error('Rank Tracker History Error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
