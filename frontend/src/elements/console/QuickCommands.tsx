import { faAngleRight, faPen, faPlus, faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { type FormEvent, useMemo, useState, useSyncExternalStore } from 'react';
import { ActionIcon, Button, SocketRequest, TextInput, useServerCan, useServerStore } from '../../lib/core.ts';
import { useExtTranslations } from '../../translations.ts';
import { commandsKey, MAX_COMMAND, MAX_COMMANDS, parseCommands, withCommand } from './console.ts';

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
 * A server's quick commands (`xylo:commands:<uuid>`, per browser), shared by every part showing them (the chips
 * above the prompt, the inspector's list), with the setter that saves them.
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
 * The saved quick commands as a row of chips just above the prompt, a click sending one while the console can take
 * it (its title says why not otherwise), and a last chip opening the inspector at the list. With none saved, only
 * that chip, which says what it is. Needs `control.console`, as core's command input does.
 */
export function CommandChips({ onEdit }: { onEdit: () => void }) {
  const { t } = useExtTranslations();
  const uuid = useServerStore((state) => state.server.uuid);
  const canConsole = useServerCan('control.console');
  const [commands] = useQuickCommands(uuid);
  const { ready, reason, send } = useCommandSender();

  if (!canConsole) return null;

  return (
    <div className='xylo-con-chips' role='group' aria-label={t('console.commands', {})}>
      {commands.map((command) => (
        <button
          key={command}
          type='button'
          className='xylo-con-chip'
          disabled={!ready}
          title={reason ?? t('console.sendCommand', { command })}
          aria-label={t('console.sendCommand', { command })}
          onClick={() => send(command)}
        >
          <FontAwesomeIcon icon={faAngleRight} className='opacity-50' />
          <span className='truncate'>{command}</span>
        </button>
      ))}
      <button
        type='button'
        className='xylo-con-chip'
        data-edit
        data-xylo-inspector-toggle
        title={t('console.editCommands', {})}
        aria-label={t('console.editCommands', {})}
        onClick={onEdit}
      >
        <FontAwesomeIcon icon={commands.length > 0 ? faPen : faPlus} />
        {commands.length === 0 && <span>{t('console.addFirstCommand', {})}</span>}
      </button>
    </div>
  );
}

/**
 * The inspector's list of quick commands: each one sends on a click (same rules as the chips) and has a remove
 * button; the field under them adds one. Keyed by the server, so a half typed command stays with its server.
 */
export function CommandsEditor() {
  const { t } = useExtTranslations();
  const uuid = useServerStore((state) => state.server.uuid);
  const [commands, save] = useQuickCommands(uuid);
  const { ready, reason, send } = useCommandSender();
  const [draft, setDraft] = useState('');

  const add = (event: FormEvent) => {
    event.preventDefault();
    const next = withCommand(commands, draft);
    if (!next) return;
    save(next);
    setDraft('');
  };

  return (
    <div className='flex flex-col gap-3'>
      {commands.length === 0 ? (
        <p className='text-sm text-(--mantine-color-dimmed)'>{t('console.commandsEmpty', {})}</p>
      ) : (
        <ul className='xylo-con-commands'>
          {commands.map((command) => (
            <li key={command}>
              <button
                type='button'
                className='xylo-con-command'
                disabled={!ready}
                title={reason ?? t('console.sendCommand', { command })}
                onClick={() => send(command)}
              >
                <FontAwesomeIcon icon={faAngleRight} className='shrink-0 opacity-50' />
                <span className='truncate'>{command}</span>
              </button>
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
      {reason && commands.length > 0 && <p className='text-xs text-(--mantine-color-dimmed)'>{reason}</p>}
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
          <Button type='submit' variant='default' disabled={withCommand(commands, draft) === null}>
            {t('console.addCommand', {})}
          </Button>
        </form>
      )}
    </div>
  );
}
