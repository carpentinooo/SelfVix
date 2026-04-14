const { addonBuilder } = require('stremio-addon-sdk');
import { getVixSrcStreams } from './vixsrc';
import { getVixCloudStreams } from './vixcloud';
import { decodeProxyToken, resolveUrl, makeProxyToken, getAddonBase } from './proxy';
import { request } from 'undici';
const express = require('express');
import { generateLandingPage } from './landing';

const manifest = {
    id: 'org.selfvix.simple',
    version: '1.1.0',
    name: 'SelfVix🤌',
    description: 'Self VixSrc and VixCloud',
    logo: 'https://icv.stremio.dpdns.org/prisonmike.png',
    background: 'https://blog.stremio.com/wp-content/uploads/2022/08/shino-1024x632.png',
    resources: ['stream'],
    types: ['movie', 'series', 'anime'],
    idPrefixes: ['tmdb:', 'tt', 'kitsu:'],
    catalogs: []
};

const builder = new addonBuilder(manifest as any);

builder.defineStreamHandler(async (args: any) => {
    // Standardize args: sometimes 'type' contains the args object when called manually via SDK interface
    let type = args.type;
    let id = args.id;
    let extra = args.extra || {};

    if (typeof type === 'object' && type.id) {
        id = type.id;
        extra = type.extra || {};
        type = type.type;
    }

    console.log("Stream request normalized:", { type, id });

    try {
        if (id && id.startsWith('kitsu:')) {
            const parts = id.split(':');
            const kitsuId = parts[1];
            const episodeNum = parts[2] || '1';
            const streams = await getVixCloudStreams(kitsuId, episodeNum);
            return { streams };
        }

        if (type === 'movie' || type === 'series') {
            let tmdbId = id;
            let season: string | undefined;
            let episode: string | undefined;

            if (type === 'movie') {
                if (id.startsWith('tmdb:')) {
                    tmdbId = id.split(':')[1];
                }
            } else if (type === 'series') {
                const parts = id.split(':');
                if (parts[0] === 'tmdb') {
                    tmdbId = parts[1];
                    season = parts[2];
                    episode = parts[3];
                } else if (parts[0].startsWith('tt')) {
                    tmdbId = parts[0];
                    season = parts[1];
                    episode = parts[2];
                }
            }

            const streams = await getVixSrcStreams(tmdbId, season, episode);
            return { streams };
        }
    } catch (err) {
        console.error("Handler error:", err);
    }

    return { streams: [] };
});

const addonInterface = builder.getInterface();

const app = express();
app.set('trust proxy', true);
app.use((req: any, res: any, next: any) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Allow-Methods', '*');
    next();
});

// ── Landing Page ──
app.get('/', (req: any, res: any) => {
    const addonBase = getAddonBase(req);
    res.send(generateLandingPage(manifest, addonBase));
});

// ── Manifest ──
app.get('/manifest.json', (req: any, res: any) => {
    res.json(addonInterface.manifest);
});

// ── Stream Endpoint Wrapper: Fix relative URLs to Absolute ──
app.get('/stream/:type/:id.json', async (req: any, res: any) => {
    const { type, id } = req.params;
    const addonBase = getAddonBase(req);

    try {
        // The SDK's handler expects the ARGS object directly.
        // If 'id' contains extension like .json, we should strip it if needed, 
        // but Express params already handled it.
        const result = await addonInterface.get('stream', { type, id, extra: req.query });

        if (result && result.streams) {
            result.streams = result.streams.map((s: any) => {
                if (s.url && s.url.startsWith('/')) {
                    s.url = `${addonBase}${s.url}`;
                }
                return s;
            });
        }
        res.json(result);
    } catch (err: any) {
        res.status(500).json({ error: err?.message || 'Internal Error' });
    }
});

// ── HLS Proxy: Master manifest rewriter (Synthetic FHD logic) ──
app.get('/proxy/hls/manifest.m3u8', async (req: any, res: any) => {
    try {
        const token = req.query.token;
        if (!token) return res.status(400).send('#EXTM3U\n# Missing token');

        const decoded = decodeProxyToken(token);
        if (!decoded) return res.status(400).send('#EXTM3U\n# Invalid token');

        const upstream = decoded.u;
        const headers = decoded.h || {};
        const expire = decoded.e || 0;

        if (!upstream) return res.status(400).send('#EXTM3U\n# Missing upstream URL');
        if (expire && Date.now() > expire) return res.status(410).send('#EXTM3U\n# Token expired');

        console.log(`[HLS Proxy] Fetching: ${upstream.substring(0, 100)}...`);

        const { body, statusCode } = await request(upstream, { headers });
        if (statusCode !== 200) {
            return res.status(502).send(`#EXTM3U\n# Upstream error ${statusCode}`);
        }

        const text = await body.text();
        const addonBase = getAddonBase(req);

        // If it's a master playlist, filter for the best video quality
        if (text.includes('#EXT-X-STREAM-INF:')) {
            const lines = text.split(/\r?\n/);

            interface Variant {
                info: string;
                url: string;
                height: number;
                bandwidth: number;
            }
            const variants: Variant[] = [];
            const mediaLines: string[] = [];
            const otherTags: string[] = [];

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                if (line.startsWith('#EXT-X-MEDIA:')) {
                    mediaLines.push(line);
                } else if (line.startsWith('#EXT-X-STREAM-INF:')) {
                    const nextLine = lines[i + 1];
                    if (nextLine && !nextLine.startsWith('#')) {
                        // Extract height and bandwidth
                        let height = 0;
                        let bandwidth = 0;
                        const hMatch = line.match(/RESOLUTION=\d+x(\d+)/i);
                        if (hMatch) height = parseInt(hMatch[1], 10);
                        const bMatch = line.match(/BANDWIDTH=(\d+)/i);
                        if (bMatch) bandwidth = parseInt(bMatch[1], 10);

                        variants.push({
                            info: line,
                            url: resolveUrl(upstream, nextLine.trim()),
                            height,
                            bandwidth
                        });
                        i++; // skip original URL line
                    }
                } else if (line.startsWith('#') && !line.startsWith('#EXTINF')) {
                    if (line === '#EXTM3U') continue;
                    otherTags.push(line);
                }
            }

            if (variants.length > 0) {
                // Sort by resolution then bandwidth
                variants.sort((a, b) => (b.height - a.height) || (b.bandwidth - a.bandwidth));
                const best = variants[0];

                const result = ['#EXTM3U'];
                for (const tag of otherTags) result.push(tag);

                // Rewrite media lines (audio/subs)
                for (const ml of mediaLines) {
                    const rewritten = ml.replace(/URI="([^"]+)"/, (_match: string, uri: string) => {
                        const absUri = resolveUrl(upstream, uri);
                        const segToken = makeProxyToken(absUri, headers);
                        return `URI="${addonBase}/proxy/hls/manifest.m3u8?token=${segToken}"`;
                    });
                    result.push(rewritten);
                }

                // Add the best variant
                const bestToken = makeProxyToken(best.url, headers);
                result.push(best.info);
                result.push(`${addonBase}/proxy/hls/manifest.m3u8?token=${bestToken}`);

                res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
                res.setHeader('Cache-Control', 'no-store');
                return res.send(result.join('\n'));
            }
        }

        // Media playlist or fallback (if no variants found): rewrite segment URLs
        const lines = text.split(/\r?\n/);
        const result: string[] = [];
        for (const line of lines) {
            if (line.includes('#EXT-X-KEY:') && line.includes('URI=')) {
                const rewritten = line.replace(/URI="([^"]+)"/, (_match: string, uri: string) => {
                    const absUri = resolveUrl(upstream, uri);
                    const segToken = makeProxyToken(absUri, headers);
                    return `URI="${addonBase}/proxy/hls/segment.ts?token=${segToken}"`;
                });
                result.push(rewritten);
            } else if (!line.startsWith('#') && line.trim()) {
                const absUrl = resolveUrl(upstream, line.trim());
                const segToken = makeProxyToken(absUrl, headers);
                result.push(`${addonBase}/proxy/hls/segment.ts?token=${segToken}`);
            } else {
                result.push(line);
            }
        }
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Cache-Control', 'no-store');
        return res.send(result.join('\n'));
    } catch (e: any) {
        console.error('[HLS Proxy] error:', e?.message || e);
        res.status(500).send('#EXTM3U\n# Internal error');
    }
});

/**
 * Some providers prepend a fake 8-byte PNG signature to TS segments.
 * Strip it only when bytes after the header still match TS sync markers.
 */
function stripFakePngHeader(content: Buffer): Buffer {
    const pngSig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    if (content.length <= 8 || !content.subarray(0, 8).equals(pngSig)) {
        return content;
    }

    const tsPayload = content.subarray(8);
    // MPEG-TS sync byte is 0x47
    if (tsPayload.length === 0 || tsPayload[0] !== 0x47) {
        return content;
    }
    if (tsPayload.length > 188 && tsPayload[188] !== 0x47) {
        return content;
    }

    console.log(`[HLS Proxy] Removed fake PNG header from TS segment (${content.length} -> ${tsPayload.length} bytes)`);
    return tsPayload;
}

// ── HLS Proxy: segment proxy ──
app.get('/proxy/hls/segment.ts', async (req: any, res: any) => {
    try {
        const token = req.query.token;
        if (!token) return res.status(400).send('Missing token');

        const decoded = decodeProxyToken(token);
        if (!decoded) return res.status(400).send('Invalid token');

        const upstream = decoded.u;
        const headers = decoded.h || {};

        if (!upstream) return res.status(400).send('Missing upstream URL');

        const { body, statusCode, headers: respHeaders } = await request(upstream, { headers });
        if (statusCode !== 200) {
            return res.status(statusCode || 502).send('Upstream error');
        }

        const contentType = respHeaders['content-type'] || 'video/mp2t';
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=3600');

        const chunks: Buffer[] = [];
        for await (const chunk of body) {
            chunks.push(Buffer.from(chunk));
        }
        const fullBuffer = Buffer.concat(chunks);
        res.send(stripFakePngHeader(fullBuffer));
    } catch (e: any) {
        console.error('[HLS Segment Proxy] error:', e?.message || e);
        res.status(500).send('Internal error');
    }
});

export default app;

if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
    const port = process.env.PORT || 7000;
    app.listen(port, () => {
        console.log(`Vix Simple Addon running at http://127.0.0.1:${port}`);
        console.log(`Manifest: http://127.0.0.1:${port}/manifest.json`);
    });
}
