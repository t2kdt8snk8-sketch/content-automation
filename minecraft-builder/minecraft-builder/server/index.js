/**
 * Express Proxy Server — Protects API keys from frontend exposure
 * Stores keys in memory per session, proxies requests to AI APIs
 */

import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3001;

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '50mb' }));

// ─── In-memory key store (per-session via simple token) ─────

const sessions = new Map();

function generateToken() {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// Clean up old sessions (older than 2 hours)
setInterval(() => {
    const cutoff = Date.now() - 2 * 60 * 60 * 1000;
    for (const [token, session] of sessions) {
        if (session.createdAt < cutoff) sessions.delete(token);
    }
}, 10 * 60 * 1000);

// ─── Routes ─────────────────────────────────────────────────

// Health check
app.get('/api/health', (req, res) => {
    const token = req.headers['x-session-token'];
    const session = sessions.get(token);
    res.json({
        status: 'ok',
        keysSet: session ? true : false,
    });
});

// Store API keys
app.post('/api/set-keys', (req, res) => {
    const { visionKey, llmKey } = req.body;
    if (!visionKey && !llmKey) {
        return res.status(400).json({ error: 'At least one API key required' });
    }

    const token = generateToken();
    sessions.set(token, {
        visionKey: visionKey || null,
        llmKey: llmKey || null,
        createdAt: Date.now(),
    });

    console.log(`[Session] New session created: ${token.slice(0, 8)}...`);
    res.json({ token, message: 'Keys stored successfully' });
});

// Proxy analyze request to AI
app.post('/api/analyze', async (req, res) => {
    const token = req.headers['x-session-token'];
    const session = sessions.get(token);

    if (!session) {
        return res.status(401).json({ error: 'No API keys set. Please configure your API keys first.' });
    }

    const { stage, image, prompt } = req.body;

    try {
        if (stage === 'vision') {
            // Call Vision API (OpenAI-compatible format)
            const apiKey = session.visionKey || session.llmKey;
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model: 'gpt-4o',
                    messages: [
                        {
                            role: 'user',
                            content: [
                                { type: 'text', text: prompt },
                                {
                                    type: 'image_url',
                                    image_url: {
                                        url: `data:image/jpeg;base64,${image}`,
                                        detail: 'high',
                                    },
                                },
                            ],
                        },
                    ],
                    max_tokens: 2000,
                    temperature: 0.3,
                }),
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                console.error('[Vision API Error]', errData);
                throw new Error(errData.error?.message || `Vision API returned ${response.status}`);
            }

            const data = await response.json();
            const result = data.choices?.[0]?.message?.content;
            res.json({ result });

        } else if (stage === 'grid') {
            // Call LLM API
            const apiKey = session.llmKey || session.visionKey;
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model: 'gpt-4o',
                    messages: [
                        { role: 'user', content: prompt },
                    ],
                    max_tokens: 16000,
                    temperature: 0.2,
                }),
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                console.error('[LLM API Error]', errData);
                throw new Error(errData.error?.message || `LLM API returned ${response.status}`);
            }

            const data = await response.json();
            const result = data.choices?.[0]?.message?.content;
            res.json({ result });

        } else {
            res.status(400).json({ error: 'Invalid stage' });
        }
    } catch (error) {
        console.error('[Proxy Error]', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`\n🟢 Minecraft Builder Proxy Server`);
    console.log(`   Running on http://localhost:${PORT}`);
    console.log(`   Accepting requests from http://localhost:5173\n`);
});
