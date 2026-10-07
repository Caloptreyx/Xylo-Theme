import { faDownload, faEraser } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { MouseEvent } from 'react';
import { ActionIcon, downloadTextFile, Tooltip, useServerStore } from '../../lib/core.ts';
import { useExtTranslations } from '../../translations.ts';
import { type BufferLine, bufferText, logFileName } from './console.ts';
import { terminalNear } from './xterm.ts';

/**
 * Two buttons in core's terminal header (every console: Xylo's page, core's, the popout): clear the terminal, and
 * download what it holds as a plain text log. Styled as core's header buttons.
 */
export default function TerminalButtons() {
  const { t } = useExtTranslations();
  const serverName = useServerStore((state) => state.server.name);

  const download = (event: MouseEvent<HTMLButtonElement>) => {
    const term = terminalNear(event.currentTarget);
    if (!term) return;
    const buffer = term.buffer.active;
    const lines: BufferLine[] = [];
    for (let i = 0; i < buffer.length; i++) {
      const line = buffer.getLine(i);
      if (line) lines.push({ text: line.translateToString(true), wrapped: line.isWrapped });
    }
    downloadTextFile(bufferText(lines), logFileName(serverName, new Date()));
  };

  return (
    <>
      <Tooltip label={t('console.clear', {})}>
        <ActionIcon
          className='group'
          size='xs'
          radius={0}
          variant='transparent'
          aria-label={t('console.clear', {})}
          onClick={(event) => terminalNear(event.currentTarget)?.clear()}
        >
          <FontAwesomeIcon
            icon={faEraser}
            className='text-(--mantine-color-dimmed) group-hover:text-(--mantine-color-text)'
          />
        </ActionIcon>
      </Tooltip>
      <Tooltip label={t('console.download', {})}>
        <ActionIcon
          className='group'
          size='xs'
          radius={0}
          variant='transparent'
          aria-label={t('console.download', {})}
          onClick={download}
        >
          <FontAwesomeIcon
            icon={faDownload}
            className='text-(--mantine-color-dimmed) group-hover:text-(--mantine-color-text)'
          />
        </ActionIcon>
      </Tooltip>
    </>
  );
}
