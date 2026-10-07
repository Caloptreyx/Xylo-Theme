import { faDiscord, faGithub } from '@fortawesome/free-brands-svg-icons';
import { faBook, faEnvelope, faHeartPulse, faLink, type IconDefinition } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useZoronTheme } from '../lib/store.ts';
import type { LoginLinkIcon } from '../lib/theme.ts';
import { useExtTranslations } from '../translations.ts';

/** Also drawn beside the icon picker in Studio. */
export const LOGIN_LINK_GLYPHS: Record<LoginLinkIcon, IconDefinition> = {
  link: faLink,
  github: faGithub,
  discord: faDiscord,
  docs: faBook,
  status: faHeartPulse,
  mail: faEnvelope,
};

/**
 * `loginLinks`: a row of chips at the top of every sign in page (core's auth pages slot), such as a demo's shared
 * login or a link to the docs. Addresses passed SAFE_URL in normalizeTheme(); root relative ones load in place,
 * the rest open in a new tab.
 */
export default function LoginLinks() {
  const { t } = useExtTranslations();
  const { loginLinks } = useZoronTheme();
  if (loginLinks.length === 0) return null;

  return (
    <nav aria-label={t('login.links', {})} className='zoron-login-links'>
      {loginLinks.map((link, index) => {
        const external = !link.url.startsWith('/');
        return (
          <a
            key={index}
            href={link.url}
            target={external ? '_blank' : undefined}
            rel={external ? 'noopener noreferrer' : undefined}
            className='zoron-login-link'
          >
            <FontAwesomeIcon icon={LOGIN_LINK_GLYPHS[link.icon]} />
            <span>{link.label}</span>
          </a>
        );
      })}
    </nav>
  );
}
