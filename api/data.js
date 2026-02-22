const fetch = require('node-fetch');

const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzIRtU26BPY4u_AEI7ZhEMrKGFg_H-e1cbFJWIadAdh3qXX7XKpjnNFKnfLAB0O_Fzclg/exec';

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
    }

    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: "read" }),
            headers: { 'Content-Type': 'application/json' }
        });

        const text = await response.text();

        try {
            const data = JSON.parse(text);
            res.status(200).json(data);
        } catch (e) {
            console.error("Failed to parse JSON from Google:", text.substring(0, 100));
            res.status(500).json({ error: "Invalid response from Google Sheets", details: text.substring(0, 100) });
        }

    } catch (error) {
        console.error('Error proxying request:', error);
        res.status(500).json({ error: 'Failed to fetch data' });
    }
};
