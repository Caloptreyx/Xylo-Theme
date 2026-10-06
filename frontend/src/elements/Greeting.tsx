import { useEffect, useState } from 'react';
import { useAuth } from '../lib/core.ts';
import { useXyloTheme } from '../lib/store.ts';
import { useExtTranslations } from '../translations.ts';

const greetingKey = (hour: number) =>
  hour < 5 ? 'greeting.night' : hour < 12 ? 'greeting.morning' : hour < 18 ? 'greeting.afternoon' : 'greeting.evening';

/** Above the servers list (`greeting` on): the user's first name, else their username, with the time of day and date. */
export default function Greeting() {
  const { t, language } = useExtTranslations();
  const { user } = useAuth();
  const theme = useXyloTheme();
  const [now, setNow] = useState(() => new Date());

  // the greeting follows the clock across a long session
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  if (!theme.greeting || !user) return null;
  const name = user.nameFirst?.trim() || user.username;
  const date = new Intl.DateTimeFormat(language || undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(now);

  return (
    <div className='xylo-pop mb-6 flex flex-col gap-1'>
      <h1 className='text-2xl font-semibold tracking-tight text-balance sm:text-3xl'>
        <span className='xylo-greeting-title'>{t(greetingKey(now.getHours()), { name })}</span>
      </h1>
      <p className='text-sm text-(--mantine-color-dimmed)'>{date}</p>
    </div>
  );
}
