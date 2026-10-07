import { faPalette } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useComputedColorScheme } from '@mantine/core';
import { type ReactNode, useState } from 'react';
import { ActionIcon, Popover, SegmentedControl, Tooltip } from '../../lib/core.ts';
import { inPreviewFrame, setTerminalPrefs, useBaseTheme, useTerminalPrefs, useZoronTheme } from '../../lib/store.ts';
import {
  lightBase,
  TERMINAL_SCHEME_GROUPS,
  TERMINAL_SKINS,
  type TerminalScheme,
  terminalPalette,
  type ZoronTheme,
} from '../../lib/theme.ts';
import { useExtTranslations } from '../../translations.ts';
import { TerminalSkinMock } from '../editor/mocks.tsx';

/** Core's terminal colours (xterm's Tango) for the 'panel' swatch, on the card it sits on. */
const PANEL_INK = { green: '#4e9a06', red: '#cc0000' };

/** A scheme at swatch size: its background with a line of text, a success and an error. */
function SchemeSwatch({ theme, scheme, dark }: { theme: ZoronTheme; scheme: TerminalScheme; dark: boolean }) {
  const palette = terminalPalette({ ...theme, terminalScheme: scheme }, dark);
  return (
    <span
      className='zoron-look-swatch flex flex-col justify-center gap-[3px] px-1.5'
      style={{ background: palette?.background ?? 'var(--zoron-card-solid)' }}
    >
      <span
        className='h-[3px] w-3/5 rounded-full'
        style={{ background: palette?.foreground ?? 'var(--mantine-color-text)' }}
      />
      <span className='h-[3px] w-2/5 rounded-full' style={{ background: palette?.ansi[2] ?? PANEL_INK.green }} />
      <span className='h-[3px] w-1/2 rounded-full' style={{ background: palette?.ansi[1] ?? PANEL_INK.red }} />
    </span>
  );
}

function LookOption({
  checked,
  frame,
  onPick,
  children,
}: {
  checked: boolean;
  frame?: boolean;
  onPick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type='button'
      role='radio'
      aria-checked={checked}
      data-frame={frame || undefined}
      className='zoron-look-option'
      onClick={onPick}
    >
      {children}
    </button>
  );
}

/**
 * A palette button in core's terminal header (every console, the popout included) while the theme lets visitors
 * choose (`terminalUserChoice`): a popover with the colour schemes and the frames, "Site default" first in each. The
 * choice is this browser's (lib/store.ts) and applies at once, to the popout too.
 */
export default function TerminalLook() {
  const { t } = useExtTranslations();
  const theme = useZoronTheme();
  const site = useBaseTheme();
  const prefs = useTerminalPrefs();
  const dark = useComputedColorScheme('dark') === 'dark';
  const [opened, setOpened] = useState(false);
  const [tab, setTab] = useState<'colours' | 'frame'>('colours');

  if (!theme.terminalUserChoice) return null;

  // the drawings sit on the page as it is in this mode
  const look = dark ? theme : { ...theme, ...lightBase(theme) };
  const palette = terminalPalette(theme, dark);

  return (
    <Popover opened={opened} onChange={setOpened} position='bottom-end' width='min(22rem, calc(100vw - 1.5rem))'>
      <Popover.Target>
        <Tooltip label={t('terminalLook.button', {})}>
          <ActionIcon
            className='group'
            size='xs'
            radius={0}
            variant='transparent'
            aria-label={t('terminalLook.button', {})}
            aria-expanded={opened}
            onClick={() => setOpened((open) => !open)}
          >
            <FontAwesomeIcon
              icon={faPalette}
              className='text-(--mantine-color-dimmed) group-hover:text-(--mantine-color-text)'
            />
          </ActionIcon>
        </Tooltip>
      </Popover.Target>
      <Popover.Dropdown p='xs'>
        <div className='zoron-look'>
          <SegmentedControl
            fullWidth
            size='xs'
            value={tab}
            onChange={(value) => setTab(value === 'frame' ? 'frame' : 'colours')}
            data={[
              { value: 'colours', label: t('terminalLook.colours', {}) },
              { value: 'frame', label: t('terminalLook.frame', {}) },
            ]}
          />

          {tab === 'colours' ? (
            <div
              className='zoron-look-list flex flex-col gap-1.5'
              role='radiogroup'
              aria-label={t('terminalLook.colours', {})}
            >
              <div className='zoron-look-grid'>
                <LookOption checked={!prefs.scheme} onPick={() => setTerminalPrefs({ ...prefs, scheme: undefined })}>
                  <SchemeSwatch theme={site} scheme={site.terminalScheme} dark={dark} />
                  <span className='zoron-look-name'>{t('terminalLook.siteDefault', {})}</span>
                </LookOption>
              </div>
              {TERMINAL_SCHEME_GROUPS.map((group) => (
                <div key={group.id} className='flex flex-col gap-1.5'>
                  <span className='zoron-look-caption'>{t(`consoleSection.${group.id}`, {})}</span>
                  <div className='zoron-look-grid'>
                    {group.schemes.map((scheme) => (
                      <LookOption
                        key={scheme}
                        checked={prefs.scheme === scheme}
                        onPick={() => setTerminalPrefs({ ...prefs, scheme })}
                      >
                        <SchemeSwatch theme={site} scheme={scheme} dark={dark} />
                        <span className='zoron-look-name'>{t(`consoleSection.${scheme}`, {})}</span>
                      </LookOption>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className='zoron-look-list zoron-look-grid' role='radiogroup' aria-label={t('terminalLook.frame', {})}>
              <LookOption frame checked={!prefs.skin} onPick={() => setTerminalPrefs({ ...prefs, skin: undefined })}>
                <span className='zoron-look-swatch block'>
                  <TerminalSkinMock
                    look={look}
                    palette={palette}
                    scheme={theme.terminalScheme}
                    skin={site.terminalSkin}
                  />
                </span>
                <span className='zoron-look-name'>{t('terminalLook.siteDefault', {})}</span>
              </LookOption>
              {TERMINAL_SKINS.map((skin) => (
                <LookOption
                  key={skin}
                  frame
                  checked={prefs.skin === skin}
                  onPick={() => setTerminalPrefs({ ...prefs, skin })}
                >
                  <span className='zoron-look-swatch block'>
                    <TerminalSkinMock look={look} palette={palette} scheme={theme.terminalScheme} skin={skin} />
                  </span>
                  <span className='zoron-look-name'>{t(`consoleSection.${skin}`, {})}</span>
                </LookOption>
              ))}
            </div>
          )}

          {inPreviewFrame && <span className='zoron-look-caption'>{t('terminalLook.previewNote', {})}</span>}
        </div>
      </Popover.Dropdown>
    </Popover>
  );
}
