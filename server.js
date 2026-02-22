const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Serve static files from current directory
app.use(express.static(path.join(__dirname)));

const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzIRtU26BPY4u_AEI7ZhEMrKGFg_H-e1cbFJWIadAdh3qXX7XKpjnNFKnfLAB0O_Fzclg/exec';

// Proxy endpoint
app.post('/api/data', async (req, res) => {
    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: "read" }),
            headers: { 'Content-Type': 'application/json' }
        });

        // Google Apps Script usually returns a 302 redirect for POST requests
        // node-fetch follows redirects by default, so 'response' should be the final result
        const text = await response.text();

        try {
            const data = JSON.parse(text);
            res.json(data);
        } catch (e) {
            console.error("Failed to parse JSON from Google:", text.substring(0, 100));
            res.status(500).json({ error: "Invalid response from Google Sheets", details: text.substring(0, 100) });
        }

    } catch (error) {
        console.error('Error proxying request:', error);
        res.status(500).json({ error: 'Failed to fetch data' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

// Vercel 환경을 위해 app 객체를 내보냅니다 (export)
module.exports = app;
