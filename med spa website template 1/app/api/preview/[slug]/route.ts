import { NextResponse } from 'next/server';

// Supabase client for fetching preview data
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://fjbowxwqaegvpjyinnsa.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function GET(
    request: Request,
    { params }: { params: { slug: string } }
) {
    const { slug } = params;

    if (!slug) {
        return NextResponse.json({ error: 'Slug is required' }, { status: 400 });
    }

    try {
        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/personalized_previews?slug=eq.${encodeURIComponent(slug)}&select=*`,
            {
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                },
                next: { revalidate: 60 } // Cache for 60 seconds
            }
        );

        if (!response.ok) {
            throw new Error('Failed to fetch preview data');
        }

        const data = await response.json();

        if (!data || data.length === 0) {
            return NextResponse.json({ error: 'Preview not found' }, { status: 404 });
        }

        return NextResponse.json(data[0]);
    } catch (error) {
        console.error('Error fetching preview:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
