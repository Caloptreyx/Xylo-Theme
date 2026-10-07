import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { type KeyboardEvent, useId } from 'react';
import { ActionIcon, ExtensionSlot, useServerCan, useServerStore } from '../../lib/core.ts';
import { useExtTranslations } from '../../translations.ts';
import { ConnectDetails } from '../server/parts.tsx';
import { CommandsEditor } from './QuickCommands.tsx';

export type InspectorTab = 'connect' | 'commands' | 'more';

const TAB_LABEL = {
  connect: 'console.connectTab',
  commands: 'console.commandsTab',
  more: 'console.moreTab',
} as const;

/**
 * The console's inspector: tabs for how to connect (the server's description first), the quick commands (with
 * `control.console`), and More, core's `statCards` and `statBlocks` slots (only when another extension fills one;
 * they mount while that tab shows). The same in the workspace's side panel and the phone's sheet; `onClose` adds a
 * close button where the panel has no other.
 */
export function Inspector({
  tab,
  onTab,
  onClose,
}: {
  tab: InspectorTab;
  onTab: (tab: InspectorTab) => void;
  onClose?: () => void;
}) {
  const { t } = useExtTranslations();
  const id = useId();
  const server = useServerStore((state) => state.server);
  const canConsole = useServerCan('control.console');
  const registry = window.extensionContext.extensionRegistry.pages.server.console;

  const tabs: InspectorTab[] = ['connect'];
  if (canConsole) tabs.push('commands');
  if (registry.statCards.length > 0 || registry.statBlocks.length > 0) tabs.push('more');
  const current = tabs.includes(tab) ? tab : 'connect';

  // arrows, Home and End move between the tabs, as a tab list does
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const at = tabs.indexOf(current);
    const next =
      event.key === 'ArrowRight'
        ? tabs[(at + 1) % tabs.length]
        : event.key === 'ArrowLeft'
          ? tabs[(at - 1 + tabs.length) % tabs.length]
          : event.key === 'Home'
            ? tabs[0]
            : event.key === 'End'
              ? tabs[tabs.length - 1]
              : null;
    if (!next) return;
    event.preventDefault();
    onTab(next);
    document.getElementById(`${id}-${next}`)?.focus();
  };

  return (
    <div className='xylo-con-inspect'>
      <div className='xylo-con-inspect-head'>
        <div role='tablist' aria-label={t('console.details', {})} className='xylo-con-tabs' onKeyDown={onKeyDown}>
          {tabs.map((name) => (
            <button
              key={name}
              type='button'
              role='tab'
              id={`${id}-${name}`}
              aria-selected={name === current}
              aria-controls={`${id}-panel`}
              tabIndex={name === current ? 0 : -1}
              className='xylo-con-tab'
              onClick={() => onTab(name)}
            >
              {t(TAB_LABEL[name], {})}
            </button>
          ))}
        </div>
        {onClose && (
          <ActionIcon variant='subtle' color='gray' aria-label={t('console.hidePanel', {})} onClick={onClose}>
            <FontAwesomeIcon icon={faXmark} />
          </ActionIcon>
        )}
      </div>
      <div role='tabpanel' id={`${id}-panel`} aria-labelledby={`${id}-${current}`} className='xylo-con-inspect-body'>
        {current === 'connect' && (
          <>
            {server.description && <p className='xylo-con-desc'>{server.description}</p>}
            <ConnectDetails />
          </>
        )}
        {current === 'commands' && <CommandsEditor key={server.uuid} />}
        {current === 'more' && (
          <>
            <ExtensionSlot components={registry.statCards} name='console-stat-card' />
            <ExtensionSlot components={registry.statBlocks} name='console-stat-block' />
          </>
        )}
      </div>
    </div>
  );
}
