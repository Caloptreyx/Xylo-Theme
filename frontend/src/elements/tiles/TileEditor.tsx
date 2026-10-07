import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ColorInput } from '@mantine/core';
import { useState } from 'react';
import { HEX, toHexColor } from '../../lib/color.ts';
import { Button, Modal, ModalFooter, TextInput, Tooltip } from '../../lib/core.ts';
import {
  cleanTileName,
  normalizeTile,
  serverTile,
  TILE_ICONS,
  TILE_NAME_MAX,
  TILE_SWATCHES,
  type TileIcon,
  type TileStyle,
} from '../../lib/tiles.ts';
import { useExtTranslations } from '../../translations.ts';
import { TILE_ICON_DEFS, TileSquare } from './TileFace.tsx';
import { useSaveTile, useServerTile, useServerTiles } from './useTiles.ts';

type TileServer = { uuid: string; name: string };

/**
 * "Customize tile": a server's own name, icon and colour for this user, with a live preview. The name's placeholder
 * is the real name; a name equal to it is not kept. Save closes at once (the change shows everywhere, and is undone
 * with a toast if the panel refuses it); Reset puts the default tile back. Render it only while open, so it starts
 * from the saved look.
 */
export function TileEditor({ server, onClose }: { server: TileServer; onClose: () => void }) {
  const { t } = useExtTranslations();
  const saved = useServerTiles()[server.uuid];
  const save = useSaveTile();
  const [name, setName] = useState(saved?.name ?? '');
  const [icon, setIcon] = useState<TileIcon | null>(saved?.icon ?? null);
  const [color, setColor] = useState(saved?.color ?? '');
  const [query, setQuery] = useState('');

  const cleanName = cleanTileName(name);
  const draft: TileStyle = {
    name: cleanName && cleanName !== server.name ? cleanName : undefined,
    icon: icon ?? undefined,
    color: HEX.test(color) ? color.toLowerCase() : undefined,
  };
  const preview = serverTile(server.name, draft);
  const colorInvalid = color !== '' && !HEX.test(color);
  const needle = query.trim().toLowerCase();
  const icons = TILE_ICONS.filter(
    (candidate) =>
      !needle || candidate.includes(needle) || t(`tiles.icons.${candidate}`, {}).toLowerCase().includes(needle),
  );

  const submit = () => {
    if (colorInvalid) return;
    onClose();
    void save(server.uuid, normalizeTile(draft));
  };

  return (
    <Modal opened onClose={onClose} title={t('tiles.title', {})}>
      <form
        className='flex flex-col gap-5'
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className='flex items-end gap-4'>
          <TileSquare tile={preview} size={56} />
          <TextInput
            className='min-w-0 flex-1'
            label={t('tiles.name', {})}
            placeholder={server.name}
            value={name}
            maxLength={TILE_NAME_MAX}
            onChange={(event) => setName(event.currentTarget.value)}
            data-autofocus
          />
        </div>

        <section className='flex flex-col gap-2'>
          <div className='flex items-center justify-between gap-3'>
            <h3 className='text-sm font-medium'>{t('tiles.icon', {})}</h3>
            <TextInput
              size='xs'
              className='w-44'
              aria-label={t('tiles.searchIcons', {})}
              placeholder={t('tiles.searchIcons', {})}
              leftSection={<FontAwesomeIcon icon={faMagnifyingGlass} />}
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
            />
          </div>
          <div className='xylo-server-tile-picks' role='group' aria-label={t('tiles.icon', {})}>
            <Tooltip label={t('tiles.initials', {})}>
              <button
                type='button'
                className='xylo-server-tile-pick'
                aria-pressed={icon === null}
                aria-label={t('tiles.initials', {})}
                onClick={() => setIcon(null)}
              >
                <span className='text-xs font-semibold'>{preview.initials}</span>
              </button>
            </Tooltip>
            {icons.map((candidate) => (
              <Tooltip key={candidate} label={t(`tiles.icons.${candidate}`, {})}>
                <button
                  type='button'
                  className='xylo-server-tile-pick'
                  aria-pressed={icon === candidate}
                  aria-label={t(`tiles.icons.${candidate}`, {})}
                  onClick={() => setIcon(candidate)}
                >
                  <FontAwesomeIcon icon={TILE_ICON_DEFS[candidate]} />
                </button>
              </Tooltip>
            ))}
          </div>
          {icons.length === 0 && <p className='text-xs text-(--mantine-color-dimmed)'>{t('tiles.noIcons', {})}</p>}
        </section>

        <section className='flex flex-col gap-2'>
          <h3 className='text-sm font-medium'>{t('tiles.color', {})}</h3>
          <div className='xylo-server-tile-picks' role='group' aria-label={t('tiles.color', {})}>
            <Tooltip label={t('tiles.autoColor', {})}>
              <button
                type='button'
                className='xylo-server-tile-swatch'
                aria-pressed={color === ''}
                aria-label={t('tiles.autoColor', {})}
                style={{ background: serverTile(server.name).background }}
                onClick={() => setColor('')}
              />
            </Tooltip>
            {TILE_SWATCHES.map((swatch) => (
              <button
                key={swatch}
                type='button'
                className='xylo-server-tile-swatch'
                aria-pressed={color.toLowerCase() === swatch}
                aria-label={swatch}
                style={{ background: swatch }}
                onClick={() => setColor(swatch)}
              />
            ))}
          </div>
          <ColorInput
            size='sm'
            label={t('tiles.customColor', {})}
            placeholder='#7c5cff'
            value={color}
            format='hex'
            error={colorInvalid ? t('colors.notHex', {}) : undefined}
            onChange={setColor}
            onBlur={() => {
              const hex = toHexColor(color);
              if (hex && hex !== color) setColor(hex);
            }}
          />
        </section>

        <p className='text-xs text-(--mantine-color-dimmed)'>{t('tiles.private', {})}</p>

        <ModalFooter>
          {saved && (
            <Button
              variant='subtle'
              color='gray'
              className='mr-auto'
              onClick={() => {
                onClose();
                void save(server.uuid, null);
              }}
            >
              {t('tiles.reset', {})}
            </Button>
          )}
          <Button variant='default' onClick={onClose}>
            {t('shell.cancel', {})}
          </Button>
          <Button type='submit' disabled={colorInvalid}>
            {t('shell.save', {})}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

/** A server's tile that opens its editor when clicked (the overview's header). */
export function TileButton({ server, size }: { server: TileServer; size: number }) {
  const { t } = useExtTranslations();
  const tile = useServerTile(server);
  const [editing, setEditing] = useState(false);
  return (
    <>
      <Tooltip label={t('tiles.customize', {})}>
        <button
          type='button'
          className='xylo-server-tile-button'
          aria-label={t('tiles.customizeNamed', { name: tile.label })}
          onClick={() => setEditing(true)}
        >
          <TileSquare tile={tile} size={size} />
        </button>
      </Tooltip>
      {editing && <TileEditor server={server} onClose={() => setEditing(false)} />}
    </>
  );
}
