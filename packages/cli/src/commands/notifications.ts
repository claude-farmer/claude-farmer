import chalk from 'chalk';
import { t, getTimeOfDay } from '@claude-farmer/shared';
import type { Locale } from '@claude-farmer/shared';
import { fetchNotifications } from '../sync/remote.js';

function getTimeAgo(dateStr: string, locale: Locale): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);

  if (minutes < 60) return t(locale, 'timeMinutesAgo', { n: minutes });
  if (hours < 24) return t(locale, 'timeHoursAgo', { n: hours });
  return t(locale, 'timeYesterday');
}

export async function showNotifications(githubId: string, locale: Locale): Promise<void> {
  const data = await fetchNotifications(githubId);
  if (!data) return;

  if (data.visitor_count === 0 && data.water_received_count === 0) return;

  const hour = new Date().getHours();
  const tod = getTimeOfDay(hour);
  const greetKey = `notifGreet${tod.charAt(0).toUpperCase()}${tod.slice(1)}` as 'notifGreetMorning' | 'notifGreetAfternoon' | 'notifGreetEvening' | 'notifGreetNight';

  console.log(`\n${chalk.green('🌱')} ${t(locale, greetKey)}\n`);

  // 물 주기 알림
  for (const w of data.water_received) {
    const timeAgo = getTimeAgo(w.at, locale);
    if (w.crop_slot != null) {
      console.log(`  ${chalk.blue('💧')} ${t(locale, 'notifWateredSlot', { nickname: `@${w.from_nickname}`, slot: w.crop_slot, timeAgo })}`);
    } else {
      console.log(`  ${chalk.blue('💧')} ${t(locale, 'notifWatered', { nickname: `@${w.from_nickname}`, timeAgo })}`);
    }
  }

  // 방문자 알림
  if (data.visitor_count > 0) {
    console.log(`  ${chalk.dim('👣')} ${t(locale, 'notifVisitors', { count: data.visitor_count })}`);
  }

  console.log('');
}
