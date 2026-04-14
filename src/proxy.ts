/**
 * HLS Proxy helpers — shared between addon.ts, vixsrc.ts, vixcloud.ts
 */

export const VIXSRC_HEADERS: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Connection': 'keep-alive',
    'Referer': 'https://vixsrc.to/'
};

export const VIXCLOUD_HEADERS: Record<string, string> = {
    'Accept': '*/*',
    'Connection': 'keep-alive',
    'Cache-Control': 'no-cache',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0'
};

export function makeProxyToken(url: string, headers: Record<string, string>, ttlMs: number = 6 * 3600 * 1000): string {
    const payload = {
        u: url,
        h: headers,
        e: Date.now() + ttlMs
    };
    return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

export function decodeProxyToken(token: string): { u: string; h: Record<string, string>; e: number } | null {
    try {
        return JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
    } catch {
        return null;
    }
}

export function resolveUrl(base: string, relative: string): string {
    if (relative.startsWith('http://') || relative.startsWith('https://')) return relative;
    try {
        return new URL(relative, base).toString();
    } catch {
        const baseUrl = new URL(base);
        if (relative.startsWith('/')) {
            return `${baseUrl.origin}${relative}`;
        }
        const basePath = baseUrl.pathname.substring(0, baseUrl.pathname.lastIndexOf('/') + 1);
        return `${baseUrl.origin}${basePath}${relative}`;
    }
}

export function getAddonBase(req: any): string {
    const protocol = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
    let host = req.headers['x-forwarded-host'] || req.headers.host || req.get('host');
    
    // If the host is just the internal app name (no dots), append the BeamUp domain.
    // BeamUp app names usually look like c15c09a3abc2-svix. We only append the domain
    // if it matches this pattern so that it doesn't interfere with Render or local dev.
    if (host && !host.includes('.') && host !== 'localhost' && process.env.BEAMUP_PROJECT_NAME) {
        // If we have an environment variable from BeamUp, we can definitely append
        host = `${host}.baby-beamup.club`;
    } else if (host && !host.includes('.') && host !== 'localhost') {
        // Fallback: append ONLY if it looks like a typical dokku internal name
        // (starts with alphanumeric, has an internal hyphen, etc.)
        if (/^[a-z0-9]+-[a-z0-9]+$/i.test(host)) {
            host = `${host}.baby-beamup.club`;
        }
    }
    
    // If x-forwarded-host is a list (from multiple proxies), take the first one
    if (host && host.includes(',')) {
        host = host.split(',')[0].trim();
    }
    
    return `${protocol}://${host}`;
}
