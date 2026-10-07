/**
 * The console page's small rules: saved quick commands, the downloaded log's name and text. Pure, so the tests can
 * run it without the panel.
 */

/** Quick commands per server and browser, as a JSON array of strings. */
export const commandsKey = (serverUuid: string) => `xylo:commands:${serverUuid}`;
export const MAX_COMMANDS = 20;
export const MAX_COMMAND = 200;

/** A command as saved: trimmed, one line, at most MAX_COMMAND characters; null when that leaves nothing valid. */
export function commandOf(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const command = input.trim();
  // biome-ignore lint/suspicious/noControlCharactersInRegex: a command is one line of printable text
  if (!command || command.length > MAX_COMMAND || /[\u0000-\u001f\u007f]/.test(command)) return null;
  return command;
}

/** The saved list, whatever is in storage: valid commands only, no repeats, at most MAX_COMMANDS. */
export function parseCommands(raw: string | null): string[] {
  let value: unknown;
  try {
    value = raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
  if (!Array.isArray(value)) return [];
  const commands: string[] = [];
  for (const item of value) {
    const command = commandOf(item);
    if (command && !commands.includes(command)) commands.push(command);
    if (commands.length === MAX_COMMANDS) break;
  }
  return commands;
}

/** `list` with `input` added at the end; null when it is invalid, already there, or the list is full. */
export function withCommand(list: readonly string[], input: string): string[] | null {
  const command = commandOf(input);
  if (!command || list.includes(command) || list.length >= MAX_COMMANDS) return null;
  return [...list, command];
}

const pad = (n: number) => String(n).padStart(2, '0');

/** `<server name>-<local date and time>.log`, the name stripped of what file systems refuse. */
export function logFileName(serverName: string, date: Date): string {
  const name =
    serverName
      // biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are what it removes
      .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]+/g, ' ')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/^\.+/, '')
      .slice(0, 80) || 'console';
  const stamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
  return `${name}-${stamp}.log`;
}

/** A terminal buffer line as plain text, and whether it continues the line before it (soft wrapped). */
export interface BufferLine {
  text: string;
  wrapped: boolean;
}

/** The buffer as a log: wrapped rows joined back into their line, trailing blank lines dropped. */
export function bufferText(lines: readonly BufferLine[]): string {
  const out: string[] = [];
  for (const { text, wrapped } of lines) {
    if (wrapped && out.length > 0) out[out.length - 1] += text;
    else out.push(text);
  }
  while (out.length > 0 && out[out.length - 1].trim() === '') out.pop();
  return out.length > 0 ? `${out.join('\n')}\n` : '';
}
