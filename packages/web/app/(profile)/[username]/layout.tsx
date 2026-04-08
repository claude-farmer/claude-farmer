import type { Metadata } from 'next';
import { redis, keys } from '@/lib/redis';
import type { PublicProfile } from '@claude-farmer/shared';

const SITE = 'https://claudefarmer.com';

async function loadProfile(username: string) {
  return redis.get<PublicProfile>(keys.user(username)).catch(() => null);
}

function ogUrlFor(username: string, profile: PublicProfile | null) {
  const v = profile?.last_active ? new Date(profile.last_active).getTime() : Date.now();
  return `${SITE}/${encodeURIComponent(username)}/og?v=${v}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const profile = await loadProfile(username);
  const ogUrl = ogUrlFor(username, profile);

  const profileUrl = `${SITE}/@${username}`;

  if (!profile) {
    const title = `@${username}'s Farm — Claude Farmer · Code Grows a Farm`;
    const desc = `${username} hasn't started farming yet. Install claude-farmer and your code automatically plants, grows, and harvests crops in a cute pixel-art farm.`;
    return {
      title,
      description: desc,
      alternates: { canonical: profileUrl },
      openGraph: {
        title,
        description: desc,
        url: profileUrl,
        siteName: 'Claude Farmer',
        type: 'profile',
        images: [{ url: ogUrl, width: 1200, height: 630, alt: `${username}'s farm on Claude Farmer` }],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description: desc,
        images: [ogUrl],
      },
    };
  }

  const harvests = profile.total_harvests ?? 0;
  const items = profile.unique_items ?? 0;
  const streak = profile.streak_days ?? 0;
  const title = `${profile.nickname}'s Farm · Lv.${profile.level} — Claude Farmer`;
  const desc = `${profile.nickname} is growing a pixel-art farm by coding with Claude. ${harvests} harvests · ${items}/32 gacha items collected · ${streak}-day streak. Visit and water their crops!`;

  return {
    title,
    description: desc,
    alternates: { canonical: profileUrl },
    openGraph: {
      title,
      description: desc,
      url: profileUrl,
      siteName: 'Claude Farmer',
      type: 'profile',
      images: [{ url: ogUrl, width: 1200, height: 630, alt: `${profile.nickname}'s farm on Claude Farmer` }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: desc,
      images: [ogUrl],
    },
  };
}

export default async function ProfileLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const profile = await loadProfile(username);
  const ogUrl = ogUrlFor(username, profile);
  const profileUrl = `${SITE}/@${username}`;

  const profileSchema = profile
    ? {
        '@context': 'https://schema.org',
        '@type': 'ProfilePage',
        url: profileUrl,
        dateCreated: profile.last_active,
        dateModified: profile.last_active,
        mainEntity: {
          '@type': 'Person',
          name: profile.nickname,
          alternateName: `@${username}`,
          url: profileUrl,
          image: ogUrl,
          identifier: username,
        },
        image: ogUrl,
        primaryImageOfPage: {
          '@type': 'ImageObject',
          url: ogUrl,
          width: 1200,
          height: 630,
        },
      }
    : {
        '@context': 'https://schema.org',
        '@type': 'ProfilePage',
        url: profileUrl,
        mainEntity: {
          '@type': 'Person',
          name: username,
          alternateName: `@${username}`,
          url: profileUrl,
          image: ogUrl,
        },
        image: ogUrl,
      };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Claude Farmer',
        item: SITE,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: profile?.nickname ?? `@${username}`,
        item: profileUrl,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify([profileSchema, breadcrumbSchema]) }}
      />
      {children}
    </>
  );
}
