import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://claudefarmer.com';
  const cliPort = request.nextUrl.searchParams.get('cli_port');

  let redirectUri = `${baseUrl}/api/auth/callback`;
  if (cliPort) {
    redirectUri += `?cli_port=${cliPort}`;
  }

  const scope = 'read:user';
  const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}`;

  return NextResponse.redirect(url);
}
