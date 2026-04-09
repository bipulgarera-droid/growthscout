const fs = require('fs');
const envData = fs.readFileSync('.env', 'utf-8');
let key = '';
envData.split('\n').forEach(line => {
    if (line.startsWith('VITE_GEMINI_API_KEY=')) {
        key = line.split('=')[1].replace(/['"]/g, '').trim();
    }
});

const prompt = 'Visit this URL and extract any email address you find on the page or contact page: https://www.benystreeserviceatx.com/. Return only the email address, nothing else. If no email found, return NULL.';
const testUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-04-17:generateContent?key=${key}`;

fetch(testUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contents: [{parts: [{text: prompt}]}],
    tools: [{ url_context: {} }],
    generationConfig: { temperature: 0.0, maxOutputTokens: 100 }
  })
}).then(r => r.json()).then(t => {
    console.log(JSON.stringify(t, null, 2));
}).catch(console.error);
