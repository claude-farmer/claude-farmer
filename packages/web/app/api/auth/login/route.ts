import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || 'https://claudefarmer.com').trim();
  const cliPort = request.nextUrl.searchParams.get('cli_port');
  const from = request.nextUrl.searchParams.get('from'); // 'vscode' | null

  let redirectUri = `${baseUrl}/api/auth/callback`;
  const params: string[] = [];
  if (cliPort) params.push(`cli_port=${cliPort}`);
  if (from) params.push(`from=${from}`);
  if (params.length > 0) redirectUri += `?${params.join('&')}`;

  const scope = 'read:user';
  const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}`;

  return NextResponse.redirect(url);
}
