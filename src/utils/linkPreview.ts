import { LinkPreviewData } from '../types/telegram';
import { parseInviteTarget, sanitizeExternalUrl } from './telegramHelpers';

const URL_MATCH_REGEX = /((?:https?:\/\/|www\.)[^\s<>"'`]+|(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(?:\/[^\s<>"'`]*)?(?:\?[^\s<>"'`]*)?(?:#[^\s<>"'`]*)?)/i;

function extractYouTubeVideoId(urlObj: URL): string | null {
  const host = urlObj.hostname.toLowerCase();
  if (host === 'youtu.be') {
    const id = urlObj.pathname.replace(/^\/+/, '').split('/')[0];
    return id && /^[a-zA-Z0-9_-]{6,20}$/.test(id) ? id : null;
  }
  if (host.includes('youtube.com')) {
    if (urlObj.pathname.startsWith('/watch')) {
      const v = urlObj.searchParams.get('v');
      return v && /^[a-zA-Z0-9_-]{6,20}$/.test(v) ? v : null;
    }
    const shortsMatch = urlObj.pathname.match(/^\/(?:shorts|embed|live)\/([a-zA-Z0-9_-]{6,20})/);
    if (shortsMatch) return shortsMatch[1];
  }
  return null;
}

export function extractFirstExternalUrl(text: string): string | null {
  if (!text || !text.trim()) return null;
  const match = text.match(URL_MATCH_REGEX);
  if (!match) return null;

  const rawToken = match[1].replace(/[.,!?;:)\]]+$/, '');
  if (parseInviteTarget(rawToken)) {
    return null;
  }

  return sanitizeExternalUrl(rawToken);
}

/**
 * Generates a safe, deterministic rich link preview object from the first external URL in a message.
 * Invite links are handled separately by InvitePreviewCard and skipped here.
 */
export function extractRichLinkPreview(text: string): LinkPreviewData | null {
  const safeUrl = extractFirstExternalUrl(text);
  if (!safeUrl) return null;

  try {
    const parsed = new URL(safeUrl);
    const domain = parsed.hostname.replace(/^www\./i, '');
    const lowerHost = domain.toLowerCase();

    // 1. YouTube video card with thumbnail
    const ytId = extractYouTubeVideoId(parsed);
    if (ytId) {
      return {
        url: safeUrl,
        domain,
        siteName: 'YouTube',
        title: 'فيديو يوتيوب',
        description: `مشاهدة المقطع على youtube.com (${ytId})`,
        imageUrl: `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`,
      };
    }

    // 2. GitHub repo/profile card
    if (lowerHost === 'github.com') {
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (parts.length >= 2) {
        return {
          url: safeUrl,
          domain,
          siteName: 'GitHub',
          title: `${parts[0]}/${parts[1]}`,
          description: 'مستودع برمجي على GitHub',
        };
      }
      if (parts.length === 1) {
        return {
          url: safeUrl,
          domain,
          siteName: 'GitHub',
          title: `@${parts[0]}`,
          description: 'ملف مطور على GitHub',
        };
      }
    }

    // 3. Wikipedia article card
    if (lowerHost.endsWith('wikipedia.org')) {
      const titleSlug = decodeURIComponent(
        parsed.pathname.replace(/^\/wiki\//, '').replace(/_/g, ' ')
      ).trim();
      return {
        url: safeUrl,
        domain,
        siteName: 'Wikipedia',
        title: titleSlug || 'موسوعة ويكيبيديا',
        description: 'مقال معرفي على ويكيبيديا',
      };
    }

    // 4. Generic safe domain preview card
    const cleanPath = decodeURIComponent(parsed.pathname)
      .replace(/^\/+|\/+$/g, '')
      .replace(/[-_]/g, ' ')
      .slice(0, 70);

    return {
      url: safeUrl,
      domain,
      siteName: domain,
      title: cleanPath ? `${domain} — ${cleanPath}` : domain,
      description: safeUrl.length > 90 ? `${safeUrl.slice(0, 87)}...` : safeUrl,
    };
  } catch {
    return null;
  }
}
