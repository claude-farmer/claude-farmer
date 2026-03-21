import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #1a1d27 0%, #232736 100%)',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ fontSize: 80, marginBottom: 16 }}>🌱</div>
        <div
          style={{
            fontSize: 60,
            fontWeight: 'bold',
            color: '#e5e7eb',
            marginBottom: 16,
          }}
        >
          Claude Farmer
        </div>
        <div
          style={{
            fontSize: 28,
            color: '#9ca3af',
            marginBottom: 40,
          }}
        >
          Your code grows a farm.
        </div>
        <div
          style={{
            display: 'flex',
            gap: 24,
            fontSize: 40,
          }}
        >
          <span>🥕</span>
          <span>🍅</span>
          <span>🌻</span>
          <span>🍓</span>
          <span>🎃</span>
          <span>🐱</span>
          <span>🦄</span>
        </div>
        <div
          style={{
            fontSize: 18,
            color: '#fbbf24',
            marginTop: 40,
          }}
        >
          npm install -g claude-farmer
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
