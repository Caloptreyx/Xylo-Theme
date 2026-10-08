import { faAngleRight, faPen, faPlus, faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { type FormEvent, useMemo, useState, useSyncExternalStore } from 'react';
import { ActionIcon, Button, SocketRequest, TextInput, useServerCan, useServerStore } from '../../lib/core.ts';
import { useZoronTheme } from '../../lib/store.ts';
import { useExtTranslations } from '../../translations.ts';
import { commandOf, commandsKey, MAX_COMMAND, MAX_COMMANDS, parseCommands, withCommand } from './console.ts';

/** Lists saved while storage refused them, kept for this load; they win over storage until the next save. */
const unsaved = new Map<string, string>();
const commandListeners = new Set<() => void>();

function readCommands(key: string): string | null {
  const kept = unsaved.get(key);
  if (kept !== undefined) return kept;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function subscribeCommands(listener: () => void) {
  commandListeners.add(listener);
  return () => {
    commandListeners.delete(listener);
  };
}

function saveCommands(key: string, next: string[]) {
  const raw = JSON.stringify(next);
  try {
    localStorage.setItem(key, raw);
    unsaved.delete(key);
  } catch {
    unsaved.set(key, raw);
  }
  for (const listener of commandListeners) listener();
}

/**
 * A server's quick commands (`zoron:commands:<uuid>`, per browser), shared by every part showing them (the chips,
 * the inspector's list), with the setter that saves them.
 */
function useQuickCommands(uuid: string) {
  const key = commandsKey(uuid);
  const raw = useSyncExternalStore(subscribeCommands, () => readCommands(key));
  const commands = useMemo(() => parseCommands(raw), [raw]);
  return [commands, (next: string[]) => saveCommands(key, next)] as const;
}

/**
 * Sends a command over the server's websocket; `ready` while it is connected and the server is not offline, with
 * `reason` saying why not otherwise.
 */
function useCommandSender() {
  const { t } = useExtTranslations();
  const state = useServerStore((state) => state.state);
  const socketConnected = useServerStore((state) => state.socketConnected);
  const socketInstance = useServerStore((state) => state.socketInstance);
  const connected = socketConnected && socketInstance !== null;
  const ready = connected && state !== 'offline';
  return {
    ready,
    reason: ready ? null : connected ? t('console.offline', {}) : t('console.connecting', {}),
    send: (command: string) => socketInstance?.send(SocketRequest.SEND_COMMAND, command),
  };
}

/**
 * The quick commands as a row of chips, just above the prompt or just under the terminal's toolbar (`consoleChips`,
 * `data-chips` on the workspace places it; 'off' shows none), a click sending one while the console can take it
 * (its title says why not otherwise): the site's (`consoleCommands`, set in Studio, marked quietly) first, then the
 * visitor's own saved ones that are not already among them, and a last chip opening the inspector at the list. With
 * none saved, only that chip, which says what it is. Without `onEdit` (the inspector is off) there is nowhere to
 * manage one's own, so only the site's show. Needs `control.console`, as core's command input does, and
 * `consoleQuickCommands`.
 */
export function CommandChips({ onEdit }: { onEdit?: () => void }) {
  const { t } = useExtTranslations();
  const theme = useZoronTheme();
  const uuid = useServerStore((state) => state.server.uuid);
  const canConsole = useServerCan('control.console');
  const [saved] = useQuickCommands(uuid);
  const { ready, reason, send } = useCommandSender();

  const site = theme.consoleCommands;
  if (!canConsole || !theme.consoleQuickCommands || theme.consoleChips === 'off' || (!onEdit && site.length === 0)) {
    return null;
  }
  const own = onEdit ? saved.filter((command) => !site.includes(command)) : [];

  // the site's and the visitor's own never overlap, so the command is a unique key
  const chip = (command: string, fromSite: boolean) => (
    <button
      key={command}
      type='button'
      className='zoron-con-chip'
      data-site={fromSite || undefined}
      disabled={!ready}
      title={reason ?? t(fromSite ? 'console.sendSiteCommand' : 'console.sendCommand', { command })}
      aria-label={t(fromSite ? 'console.sendSiteCommand' : 'console.sendCommand', { command })}
      onClick={() => send(command)}
    >
      <FontAwesomeIcon icon={faAngleRight} className='zoron-con-chip-cue' />
      <span className='truncate'>{command}</span>
    </button>
  );

  return (
    <div className='zoron-con-chips' role='group' aria-label={t('console.commands', {})}>
      {site.map((command) => chip(command, true))}
      {own.map((command) => chip(command, false))}
      {onEdit && (
        <button
          type='button'
          className='zoron-con-chip'
          data-edit
          data-zoron-inspector-toggle
          title={t('console.editCommands', {})}
          aria-label={t('console.editCommands', {})}
          onClick={onEdit}
        >
          <FontAwesomeIcon icon={own.length > 0 ? faPen : faPlus} />
          {own.length === 0 && <span>{t('console.addFirstCommand', {})}</span>}
        </button>
      )}
    </div>
  );
}

/** One row of the inspector's list: the whole row sends the command (same rules as the chips). */
function CommandRow({
  command,
  title,
  disabled,
  onClick,
}: {
  command: string;
  title: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button type='button' className='zoron-con-command' disabled={disabled} title={title} onClick={onClick}>
      <FontAwesomeIcon icon={faAngleRight} className='shrink-0 opacity-50' />
      <span className='truncate'>{command}</span>
    </button>
  );
}

/**
 * The inspector's list of quick commands: the site's first (under their own heading, no remove button), then the
 * visitor's own, each with a remove button; each one sends on a click (same rules as the chips) and the field under
 * them adds one (not one the site already has). Keyed by the server, so a half typed command stays with its server.
 */
export function CommandsEditor() {
  const { t } = useExtTranslations();
  const theme = useZoronTheme();
  const uuid = useServerStore((state) => state.server.uuid);
  const [commands, save] = useQuickCommands(uuid);
  const { ready, reason, send } = useCommandSender();
  const [draft, setDraft] = useState('');

  const site = theme.consoleCommands;
  const own = commands.filter((command) => !site.includes(command));
  const typed = commandOf(draft);
  const next = typed !== null && !site.includes(typed) ? withCommand(commands, typed) : null;

  const add = (event: FormEvent) => {
    event.preventDefault();
    if (!next) return;
    save(next);
    setDraft('');
  };

  return (
    <div className='flex flex-col gap-3'>
      {site.length > 0 && (
        <>
          <h3 className='zoron-con-commands-head'>{t('console.siteCommands', {})}</h3>
          <ul className='zoron-con-commands'>
            {site.map((command) => (
              <li key={command}>
                <CommandRow
                  command={command}
                  title={reason ?? t('console.sendSiteCommand', { command })}
                  disabled={!ready}
                  onClick={() => send(command)}
                />
              </li>
            ))}
          </ul>
          <h3 className='zoron-con-commands-head'>{t('console.ownCommands', {})}</h3>
        </>
      )}
      {own.length === 0 ? (
        <p className='text-sm text-(--mantine-color-dimmed)'>
          {t(site.length > 0 ? 'console.ownEmpty' : 'console.commandsEmpty', {})}
        </p>
      ) : (
        <ul className='zoron-con-commands'>
          {own.map((command) => (
            <li key={command}>
              <CommandRow
                command={command}
                title={reason ?? t('console.sendCommand', { command })}
                disabled={!ready}
                onClick={() => send(command)}
              />
              <ActionIcon
                variant='subtle'
                color='gray'
                size='md'
                aria-label={t('console.removeCommand', { command })}
                onClick={() => save(commands.filter((saved) => saved !== command))}
              >
                <FontAwesomeIcon icon={faXmark} />
              </ActionIcon>
            </li>
          ))}
        </ul>
      )}
      {reason && site.length + own.length > 0 && <p className='text-xs text-(--mantine-color-dimmed)'>{reason}</p>}
      {commands.length >= MAX_COMMANDS ? (
        <p className='text-xs text-(--mantine-color-dimmed)'>
          {t('console.commandsFull', { count: `${MAX_COMMANDS}` })}
        </p>
      ) : (
        <form onSubmit={add} className='flex gap-2'>
          <TextInput
            className='min-w-0 flex-1'
            value={draft}
            onChange={(event) => setDraft(event.currentTarget.value)}
            placeholder={t('console.commandPlaceholder', {})}
            aria-label={t('console.commandPlaceholder', {})}
            maxLength={MAX_COMMAND}
            classNames={{ input: 'font-mono' }}
          />
          <Button type='submit' variant='default' disabled={next === null}>
            {t('console.addCommand', {})}
          </Button>
        </form>
      )}
    </div>
  );
}
