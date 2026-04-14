import * as cheerio from 'cheerio';
import { request } from 'undici';
import { config } from './config';
import { makeProxyToken, VIXCLOUD_HEADERS } from './proxy';

const ANIMEMAPPING_BASE = 'https://animemapping.stremio.dpdns.org';
const AU_BASE = 'https://www.animeunity.so';
const AU_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';

// ── Step 1: Resolve Kitsu ID → title + AnimeUnity path via animemapping ──
async function resolveFromMapping(kitsuId: string, episodeNum: string): Promise<string | null> {
    try {
        const ep = parseInt(episodeNum) || 1;
        const url = `${ANIMEMAPPING_BASE}/kitsu/${kitsuId}?ep=${ep}`;
        console.log(`[VixCloud] Fetching mapping: ${url}`);
        const { body, statusCode } = await request(url, { headers: { 'Accept': 'application/json' } });
        if (statusCode !== 200) {
            console.log(`[VixCloud] Mapping API returned ${statusCode}`);
            return null;
        }
        const data: any = await body.json();
        
        // Extract animeunity paths from mapping
        const auMapping = data?.mappings?.animeunity;
        if (auMapping) {
            const paths = Array.isArray(auMapping) ? auMapping : [auMapping];
            for (const item of paths) {
                const path = typeof item === 'string' ? item : (item?.path || item?.url || item?.href || null);
                if (path) {
                    console.log(`[VixCloud] Mapping found AnimeUnity path: ${path}`);
                    return path;
                }
            }
        }
        console.log(`[VixCloud] No AnimeUnity path in mapping response`);
        return null;
    } catch (err: any) {
        console.error('[VixCloud] Mapping API error:', err?.message || err);
        return null;
    }
}

// ── Step 2: Get episode number from mapping (handles absolute episode remapping) ──
async function resolveEpisodeFromMapping(kitsuId: string, episodeNum: string): Promise<number> {
    try {
        const ep = parseInt(episodeNum) || 1;
        const url = `${ANIMEMAPPING_BASE}/kitsu/${kitsuId}?ep=${ep}`;
        const { body, statusCode } = await request(url, { headers: { 'Accept': 'application/json' } });
        if (statusCode !== 200) return ep;
        const data: any = await body.json();
        
        // Check for remapped episode number
        const fromKitsu = data?.kitsu?.episode;
        if (fromKitsu && typeof fromKitsu === 'number' && fromKitsu > 0) return fromKitsu;
        const fromRequested = data?.requested?.episode;
        if (fromRequested && typeof fromRequested === 'number' && fromRequested > 0) return fromRequested;
        return ep;
    } catch {
        return parseInt(episodeNum) || 1;
    }
}

// ── Step 3: Kitsu canonical title fallback ──
async function getKitsuTitle(kitsuId: string): Promise<string | null> {
    try {
        const { body, statusCode } = await request(`https://kitsu.io/api/edge/anime/${kitsuId}`);
        if (statusCode !== 200) return null;
        const data: any = await body.json();
        const attr = data?.data?.attributes;
        return attr?.titles?.en || attr?.titles?.en_jp || attr?.canonicalTitle || null;
    } catch {
        return null;
    }
}

// ── Step 4: AnimeUnity session + search ──
async function getAnimeUnitySession(): Promise<{csrfToken: string, cookie: string}> {
    const { body, headers } = await request(AU_BASE, {
        headers: { 'User-Agent': AU_UA }
    });
    const html = await body.text();
    const $ = cheerio.load(html);
    const csrfToken = $('meta[name="csrf-token"]').attr('content') || '';
    let cookie = '';
    const setCookieHeader = headers['set-cookie'];
    if (setCookieHeader) {
         if (Array.isArray(setCookieHeader)) {
             cookie = setCookieHeader.map((c: string) => c.split(';')[0]).join('; ');
         } else {
             cookie = String(setCookieHeader).split(';')[0] || '';
         }
    }
    return { csrfToken, cookie };
}

async function searchAnimeUnity(title: string, session: {csrfToken: string, cookie: string}): Promise<any[]> {
    const { body } = await request(`${AU_BASE}/livesearch`, {
        method: 'POST',
        headers: {
            'User-Agent': AU_UA,
            'X-Requested-With': 'XMLHttpRequest',
            'Content-Type': 'application/json;charset=utf-8',
            'X-CSRF-Token': session.csrfToken,
            'Referer': AU_BASE + '/',
            'Cookie': session.cookie
        },
        body: JSON.stringify({ title })
    });
    const result: any = await body.json();
    return result?.records || [];
}

// ── Step 5: Extract embed URL from AnimeUnity anime page ──
async function getEmbedUrl(animePath: string, episodeNum: number): Promise<string | null> {
    const animeUrl = animePath.startsWith('http') ? animePath : `${AU_BASE}${animePath}`;
    console.log(`[VixCloud] Fetching anime page: ${animeUrl}`);
    
    const { body } = await request(animeUrl, {
        headers: { 'User-Agent': AU_UA }
    });
    const html = await body.text();
    const $ = cheerio.load(html);
    
    const vp = $('video-player').first();
    const episodesStr = vp.attr('episodes') || '[]';
    
    let parsedEpisodes: any[] = [];
    try {
        // AnimeUnity HTML-encodes the JSON
        const unescaped = episodesStr
            .replace(/&quot;/g, '"')
            .replace(/&#039;/g, "'")
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>');
        parsedEpisodes = JSON.parse(unescaped);
    } catch(e) {
        console.error('[VixCloud] Failed to parse episodes JSON');
        return null;
    }

    // Find episode by number
    const targetEp = parsedEpisodes.find((e: any) => {
        const num = parseFloat(String(e.number || ''));
        return num === episodeNum;
    });
    
    if (!targetEp) {
        console.log(`[VixCloud] Episode ${episodeNum} not found in ${parsedEpisodes.length} episodes`);
        // For movies or single-episode anime, just use the first episode
        if (parsedEpisodes.length === 1) {
            const singleEp = parsedEpisodes[0];
            return singleEp.embed_url || null;
        }
        return null;
    }

    // Get embed URL from the episode page
    const epPageUrl = `${animeUrl}/${targetEp.id}`;
    console.log(`[VixCloud] Fetching episode page: ${epPageUrl}`);
    
    const { body: epBody } = await request(epPageUrl, {
        headers: { 'User-Agent': AU_UA }
    });
    const epHtml = await epBody.text();
    const $ep = cheerio.load(epHtml);
    
    let embedUrl = $ep('video-player').first().attr('embed_url');
    if (!embedUrl) {
        embedUrl = $ep('iframe[src*="vixcloud"]').first().attr('src');
    }
    if (embedUrl && !embedUrl.startsWith('http')) {
        embedUrl = AU_BASE + embedUrl;
    }
    
    return embedUrl || null;
}

// ── Step 6: Extract HLS manifest from VixCloud embed ──
async function extractVixCloudManifest(embedUrl: string): Promise<string | null> {
    console.log(`[VixCloud] Extracting manifest from embed: ${embedUrl}`);
    
    // Parse input URL for fallback tokens
    const inputUrlObj = new URL(embedUrl);
    const tokenFromInput = inputUrlObj.searchParams.get('token');
    const expiresFromInput = inputUrlObj.searchParams.get('expires');
    const asnFromInput = inputUrlObj.searchParams.get('asn');

    const { body, statusCode } = await request(embedUrl, {
        headers: VIXCLOUD_HEADERS
    });

    let html = "";
    if (statusCode === 200) {
        html = await body.text();
    } else if (statusCode === 403 && tokenFromInput && expiresFromInput) {
        console.log("[VixCloud] 403 Received, but tokens provided in URL. Using fallback.");
    } else {
        console.log(`[VixCloud] Embed fetch failed with status ${statusCode}`);
        return null;
    }
    
    // Extract components from script
    let token = tokenFromInput || "";
    let expires = expiresFromInput || "";
    let asn = asnFromInput || "";
    let playlistUrl = "";

    // Regex for window.masterPlaylist block
    const masterPlaylistMatch = html.match(/window\.masterPlaylist\s*=\s*\{.*?params\s*:\s*\{(?<params>.*?)\}\s*,\s*url\s*:\s*['"](?<url>[^'"]+)['"]/s);
    
    if (masterPlaylistMatch?.groups) {
        const paramsBlock = masterPlaylistMatch.groups.params;
        playlistUrl = masterPlaylistMatch.groups.url.replace(/\\/g, '');
        
        const tMatch = paramsBlock.match(/['"]token['"]\s*:\s*['"]([^'"]+)['"]/);
        const eMatch = paramsBlock.match(/['"]expires['"]\s*:\s*['"]([^'"]+)['"]/);
        const aMatch = paramsBlock.match(/['"]asn['"]\s*:\s*['"]([^'"]+)['"]/);
        
        if (tMatch) token = tMatch[1];
        if (eMatch) expires = eMatch[1];
        if (aMatch) asn = aMatch[1];
    } else {
        // Fallback regex patterns (match Python implementation)
        const urlMatch = html.match(/masterPlaylist[\s\S]*?url\s*:\s*['"]([^'"]+)['"]/) || html.match(/url\s*:\s*['"](https?:[^'"]+\/playlist\/[^'"]+)['"]/);
        const tMatch = html.match(/token['"]\s*:\s*['"]([^'"]+)['"]/);
        const eMatch = html.match(/expires['"]\s*:\s*['"](\d+)['"]/);
        const aMatch = html.match(/asn['"]\s*:\s*['"]([^'"]*)['"]/);

        if (urlMatch) playlistUrl = urlMatch[1].replace(/\\/g, '');
        if (tMatch && !token) token = tMatch[1];
        if (eMatch && !expires) expires = eMatch[1];
        if (aMatch && !asn) asn = aMatch[1];
    }

    // Build fallback playlist URL if missing
    if (!playlistUrl) {
        const videoIdMatch = embedUrl.match(/\/embed\/(\d+)/);
        if (videoIdMatch) {
            playlistUrl = `${inputUrlObj.origin}/playlist/${videoIdMatch[1]}`;
        }
    }

    if (!token || !expires || !playlistUrl) {
        console.log(`[VixCloud] Extraction failed: token=${!!token} expires=${!!expires} url=${!!playlistUrl}`);
        return null;
    }

    // Build final URL
    const finalUrlObj = new URL(playlistUrl);
    finalUrlObj.searchParams.set('token', token);
    finalUrlObj.searchParams.set('expires', expires);
    if (asn) finalUrlObj.searchParams.set('asn', asn);
    
    // Check FHD
    const canFHD = /canPlayFHD\s*=\s*true/i.test(html) || inputUrlObj.searchParams.get('canPlayFHD') === '1';
    if (canFHD) finalUrlObj.searchParams.set('h', '1');

    console.log(`[VixCloud] Extracted manifest: ${finalUrlObj.toString()}`);
    return ensureM3u8(finalUrlObj.toString());
}

function ensureM3u8(url: string): string {
    try {
        const u = new URL(url);
        if (u.pathname.includes('/playlist/')) {
            const parts = u.pathname.split('/');
            const leaf = parts[parts.length - 1];
            if (leaf && !leaf.includes('.') && !leaf.endsWith('.m3u8')) {
                u.pathname = u.pathname + '.m3u8';
                return u.toString();
            }
        }
        return url;
    } catch { return url; }
}

// ── Main entry point ──
export async function getVixCloudStreams(kitsuId: string, episodeNumber: string = "1"): Promise<{name: string, title: string, url: string}[]> {
    try {
        console.log(`[VixCloud] Resolving kitsu:${kitsuId} ep=${episodeNumber}`);
        
        // 1. Try animemapping API first for direct AnimeUnity path
        const resolvedEp = await resolveEpisodeFromMapping(kitsuId, episodeNumber);
        const mappedPath = await resolveFromMapping(kitsuId, episodeNumber);
        
        let embedUrl: string | null = null;
        
        if (mappedPath) {
            // We have a direct path from the mapping API
            embedUrl = await getEmbedUrl(mappedPath, resolvedEp);
        }
        
        // 2. Fallback: search AnimeUnity by title
        if (!embedUrl) {
            const title = await getKitsuTitle(kitsuId);
            if (!title) {
                console.log(`[VixCloud] Could not resolve title for kitsu:${kitsuId}`);
                return [];
            }
            console.log(`[VixCloud] Searching AnimeUnity for title: "${title}"`);
            
            const session = await getAnimeUnitySession();
            const searchResults = await searchAnimeUnity(title, session);
            
            if (searchResults.length === 0) {
                console.log(`[VixCloud] No AnimeUnity results for "${title}"`);
                return [];
            }
            
            // Use the first matching result
            const anime = searchResults[0];
            const animePath = `/anime/${anime.id}-${anime.slug}`;
            console.log(`[VixCloud] Found AnimeUnity: id=${anime.id} slug=${anime.slug}`);
            
            embedUrl = await getEmbedUrl(animePath, resolvedEp);
        }
        
        if (!embedUrl) {
            console.log(`[VixCloud] No embed URL found`);
            return [];
        }
        
        // 3. Extract manifest from VixCloud embed
        const manifestUrl = await extractVixCloudManifest(embedUrl);
        if (!manifestUrl) {
            console.log(`[VixCloud] Failed to extract manifest`);
            return [];
        }
        
        console.log(`[VixCloud] Raw manifest URL: ${manifestUrl}`);
        
        // 4. Wrap through local HLS proxy
        const proxyToken = makeProxyToken(manifestUrl, VIXCLOUD_HEADERS);

        return [{
            name: "AU 🤌",
            title: "VIX 1080 🤌",
            url: `/proxy/hls/manifest.m3u8?token=${proxyToken}`
        }];

    } catch (err: any) {
        console.error("VixCloud Stream extraction error:", err?.message || err);
        return [];
    }
}
