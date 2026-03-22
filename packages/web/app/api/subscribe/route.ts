import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { redis, keys } from '@/lib/redis';

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

export async function POST(request: NextRequest) {
  const { email } = await request.json();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Redis에 구독자 저장
  await redis.sadd(keys.subscribers, normalizedEmail);

  // 환영 이메일 발송
  try {
    await getResend().emails.send({
      from: `Claude Farmer <${process.env.RESEND_EMAIL}>`,
      to: normalizedEmail,
      subject: '🌱 Claude Farmer에 오신 걸 환영해요!',
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #1a1d27; color: #e5e7eb; border-radius: 16px;">
          <h1 style="font-size: 24px; text-align: center;">🌱 Claude Farmer</h1>
          <p style="text-align: center; opacity: 0.7;">구독해주셔서 감사해요!</p>
          <hr style="border: 1px solid #2a2d3a; margin: 24px 0;" />
          <p>안녕하세요! Claude Farmer 소식을 받아보시게 됐어요.</p>
          <p>새 기능, 시즌 이벤트, 업데이트 소식을 보내드릴게요.</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="https://claudefarmer.com" style="display: inline-block; background: #fbbf24; color: #000; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
              농장 구경하기 →
            </a>
          </div>
          <p style="font-size: 12px; opacity: 0.4; text-align: center;">
            npm install -g claude-farmer
          </p>
        </div>
      `,
    });
  } catch {
    // 이메일 발송 실패해도 구독은 유지
  }

  return NextResponse.json({ ok: true });
}
