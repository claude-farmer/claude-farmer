import { createHmac } from 'crypto';
import { NextRequest } from 'next/server';

const SECRET = process.env.SESSION_SECRET || process.env.GITHUB_CLIENT_SECRET || 'claude-farmer-default-secret';

interface SessionData {
  github_id: string;
  nickname: string;
  avatar_url: string;
}

/** 세션 데이터에 HMAC 서명 추가 */
export function signSession(data: SessionData): string {
  const payload = JSON.stringify(data);
  const sig = createHmac('sha256', SECRET).update(payload).digest('hex').slice(0, 16);
  return `${sig}.${Buffer.from(payload).toString('base64')}`;
}

/** 서명된 세션 쿠키 검증 + 파싱 */
export function verifySession(cookie: string): SessionData | null {
  // 신규 서명 포맷: sig.base64payload
  const dotIdx = cookie.indexOf('.');
  if (dotIdx > 0) {
    const sig = cookie.slice(0, dotIdx);
    const b64 = cookie.slice(dotIdx + 1);
    try {
      const payload = Buffer.from(b64, 'base64').toString();
      const expected = createHmac('sha256', SECRET).update(payload).digest('hex').slice(0, 16);
      if (sig !== expected) return null;
      return JSON.parse(payload);
    } catch {
      return null;
    }
  }

  // 레거시 포맷 호환: 서명 없는 JSON (기존 유저 쿠키)
  try {
    const data = JSON.parse(cookie);
    if (data.github_id) return data as SessionData;
  } catch {}
  return null;
}

/** 요청에서 인증된 사용자 ID 추출 (session cookie 우선, body fallback) */
export function extractUserId(request: NextRequest, bodyFrom?: string): string | null {
  const session = request.cookies.get('cf_session')?.value;
  if (session) {
    const data = verifySession(session);
    if (data) return data.github_id;
  }
  return bodyFrom || null;
}
