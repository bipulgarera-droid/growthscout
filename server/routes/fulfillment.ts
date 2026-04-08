import { Router } from 'express';
import { supabase } from '../supabaseClient.js';

const router = Router();

router.post('/api/webhook/form', async (req, res) => {
    try {
        const { slug, name, phone, email, message } = req.body;
        
        if (!slug || !name || (!phone && !email)) {
             return res.status(400).json({ error: 'Missing required fields: slug, name, and either phone or email.'});
        }

        // 1. Fetch the business to get their phone number for notification
        const { data: presInfo } = await supabase
            .from('personalized_previews')
            .select('*')
            .eq('slug', slug)
            .single();

        let ownerPhone = null;
        let businessName = slug;

        if (presInfo) {
            const { data: leadInfo } = await supabase
                .from('leads')
                .select('*')
                .eq('id', presInfo.original_lead_id)
                .single();
            
            if (leadInfo) {
                ownerPhone = leadInfo.phone;
                businessName = leadInfo.business_name;
            }
        }

        // 2. Insert into the client_leads table
        const { error: dbError } = await supabase
            .from('client_leads')
            .insert({
                business_slug: slug,
                customer_name: name,
                customer_phone: phone,
                customer_email: email,
                message: message || ''
            });
            
        if (dbError) {
            console.error("Failed to append client lead", dbError);
        }

        // 3. Notify the business owner via Twilio SMS (if they have a phone on file)
        const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
        const TWILIO_AUTH = process.env.TWILIO_AUTH_TOKEN;
        const TWILIO_PHONE = process.env.TWILIO_PHONE_NUMBER;

        if (ownerPhone && TWILIO_SID && TWILIO_AUTH && TWILIO_PHONE) {
            try {
                let notificationMsg = `🚨 New Lead from your website (${businessName})! 🚨\nName: ${name}\n`;
                if (phone) notificationMsg += `Phone: ${phone}\n`;
                if (email) notificationMsg += `Email: ${email}\n`;
                if (message) notificationMsg += `Message: ${message}`;
                
                const twilioDest = ownerPhone.startsWith('+') ? ownerPhone : `+1${ownerPhone.replace(/\D/g, '')}`;
                
                const searchParams = new URLSearchParams();
                searchParams.append('To', twilioDest);
                searchParams.append('From', TWILIO_PHONE);
                searchParams.append('Body', notificationMsg);

                const twilioRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Basic ' + Buffer.from(`${TWILIO_SID}:${TWILIO_AUTH}`).toString('base64'),
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: searchParams.toString()
                });

                if (!twilioRes.ok) {
                    const twilioErrBody = await twilioRes.text();
                    console.error("Twilio form webhook SMS failed (HTTP):", twilioErrBody);
                } else {
                    console.log(`Successfully sent SMS lead alert to owner for ${slug}`);
                }
            } catch (twilioErr) {
                console.error("Twilio form webhook SMS failed (Network):", twilioErr);
            }
        }

        if (!ownerPhone) {
            console.log(`Lead stored. No phone on file for slug ${slug}, skipped SMS.`);
        }

        res.status(200).json({ success: true, message: 'Lead captured and notification sent' });
    } catch (error: any) {
        console.error('Form Webhook Error:', error);
        res.status(500).json({ error: error.message });
    }
});

router.get('/r/:slug', async (req, res) => {
    try {
        const slug = req.params.slug;
        
        // Fetch lead's review gate configuration
        const { data: business } = await supabase
            .from('leads')
            .select('business_name, review_url, logo_url')
            .eq('slug', slug)
            .single();

        if (!business) {
            return res.status(404).send('Business not found.');
        }

        const fallbackLogo = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(business.business_name);
        const logo = business.logo_url || fallbackLogo;
        const reviewUrl = business.review_url || `https://www.google.com/search?q=${encodeURIComponent(business.business_name)}`;

        // Ultra-clean Review Gate HTML
        const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Feedback - ${business.business_name}</title>
            <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="bg-gray-50 flex items-center justify-center min-h-screen font-sans antialiased text-gray-900 px-4">
            <div class="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center" id="container">
                <img src="${logo}" alt="${business.business_name} Logo" class="h-16 mx-auto mb-6 object-contain rounded-lg">
                <h1 class="text-2xl font-bold mb-2">How was your experience?</h1>
                <p class="text-gray-500 mb-8">We value your feedback. Please rate your experience.</p>
                
                <div class="flex justify-center gap-2 mb-8 flex-row-reverse">
                    <!-- 5 Stars Configuration -->
                    <button class="peer star-btn text-gray-300 hover:text-yellow-400 focus:text-yellow-400 transition-colors" data-rating="5">
                        <svg class="w-12 h-12 fill-current" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                    </button>
                    <button class="peer peer-hover:text-yellow-400 star-btn text-gray-300 transition-colors" data-rating="4">
                        <svg class="w-12 h-12 fill-current" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                    </button>
                    <button class="peer peer-hover:text-yellow-400 star-btn text-gray-300 transition-colors" data-rating="3">
                        <svg class="w-12 h-12 fill-current" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                    </button>
                    <button class="peer peer-hover:text-yellow-400 star-btn text-gray-300 transition-colors" data-rating="2">
                        <svg class="w-12 h-12 fill-current" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                    </button>
                    <button class="peer peer-hover:text-yellow-400 star-btn text-gray-300 transition-colors" data-rating="1">
                        <svg class="w-12 h-12 fill-current" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                    </button>
                </div>

                <div id="feedback-form" class="hidden text-left animate-fade-in">
                    <p class="text-sm text-gray-600 mb-4">We're sorry we didn't meet your expectations. How can we improve?</p>
                    <textarea class="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-blue-500 focus:ring-0 outline-none transition-colors min-h-[120px]" placeholder="Your feedback..."></textarea>
                    <button class="w-full mt-4 bg-gray-900 text-white py-3 rounded-xl font-bold hover:bg-gray-800 transition-colors">Submit Private Feedback</button>
                </div>
            </div>

            <script>
                // Make preceding stars yellow too
                const stars = document.querySelectorAll('.star-btn');
                const form = document.getElementById('feedback-form');
                const container = document.getElementById('container');
                
                stars.forEach(star => {
                    star.addEventListener('click', () => {
                        const rating = parseInt(star.getAttribute('data-rating'));
                        if (rating >= 4) {
                            // High rating: Send exactly to Google Reviews
                            window.location.href = "${reviewUrl}";
                        } else {
                            // Low rating: Intercept with private feedback form (Review Gate!)
                            stars.forEach(s => s.parentElement.classList.add('hidden'));
                            form.classList.remove('hidden');
                        }
                    });
                });
            </script>
        </body>
        </html>
        `;
        
        res.send(html);
    } catch (e) {
        res.status(500).send('Internal Server Error');
    }
});

// Private feedback submit
router.post('/api/reviews/:slug/feedback', (req, res) => {
    // Save poor feedback to Supabase, bypassing public visibility
    res.json({ success: true });
});

router.post('/api/webhooks/twilio/voice/:slug', async (req, res) => {
    try {
        const slug = req.params.slug;
        const callerPhone = req.body.From; // The person who dialed the twilio number
        
        // Lookup the business to see what the missed call text template is
        const { data: business } = await supabase
            .from('leads')
            .select('business_name, phone, missed_call_template')
            .eq('slug', slug)
            .single();

        if (!business) {
            // Bad route
            return res.type('text/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response><Reject/></Response>');
        }

        const missedCallMsg = business.missed_call_template || `Hi, this is ${business.business_name}. We missed your call! How can we help you today?`;

        // We use pure XML string interpolation for TwiML without requiring the Twilio SDK module
        // 1. Dial the official business number (forwarding)
        // 2. If the call isn't picked up, Twilio drops to the next XML node. We send an SMS.
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <!-- Try to forward to the owner's real phone -->
    <Dial timeout="15">${business.phone}</Dial>
    <!-- If not answered, send the missed call text back -->
    <Sms from="${req.body.To}" to="${callerPhone}">${missedCallMsg}</Sms>
    <Say>We are currently unavailable. We have just sent you a text message. Please reply to the text!</Say>
</Response>`;

        res.type('text/xml').send(twiml);
    } catch (error: any) {
        console.error('Twilio Voice Webhook Error:', error);
        res.type('text/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response><Reject/></Response>');
    }
});

export default router;
