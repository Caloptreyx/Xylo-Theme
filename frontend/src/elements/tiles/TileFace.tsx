import {
  faAnchor,
  faBolt,
  faBomb,
  faBookSkull,
  faCampground,
  faChessKnight,
  faChessRook,
  faCoins,
  faCrosshairs,
  faCrown,
  faCube,
  faCubes,
  faDiceD20,
  faDragon,
  faDungeon,
  faFire,
  faFlask,
  faGamepad,
  faGem,
  faGhost,
  faGlobe,
  faHammer,
  faHatWizard,
  faKhanda,
  faLeaf,
  faMeteor,
  faMoon,
  faMountain,
  faPaw,
  faRobot,
  faRocket,
  faScroll,
  faSeedling,
  faServer,
  faShieldHalved,
  faSkull,
  faSnowflake,
  faStar,
  faSun,
  faTerminal,
  faTree,
  faTrophy,
  faWandMagicSparkles,
  faWater,
  type IconDefinition,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { CSSProperties } from 'react';
import type { Tile, TileIcon } from '../../lib/tiles.ts';
import { useExtTranslations } from '../../translations.ts';
import { useServerTile } from './useTiles.ts';

/** lib/tiles.ts's icon names to their FontAwesome icons. */
export const TILE_ICON_DEFS: Record<TileIcon, IconDefinition> = {
  cube: faCube,
  cubes: faCubes,
  gamepad: faGamepad,
  'dice-d20': faDiceD20,
  'chess-rook': faChessRook,
  'chess-knight': faChessKnight,
  dungeon: faDungeon,
  dragon: faDragon,
  khanda: faKhanda,
  hammer: faHammer,
  'shield-halved': faShieldHalved,
  crown: faCrown,
  gem: faGem,
  coins: faCoins,
  trophy: faTrophy,
  skull: faSkull,
  ghost: faGhost,
  'hat-wizard': faHatWizard,
  'wand-magic-sparkles': faWandMagicSparkles,
  flask: faFlask,
  'book-skull': faBookSkull,
  scroll: faScroll,
  fire: faFire,
  bolt: faBolt,
  leaf: faLeaf,
  seedling: faSeedling,
  tree: faTree,
  mountain: faMountain,
  water: faWater,
  snowflake: faSnowflake,
  sun: faSun,
  moon: faMoon,
  star: faStar,
  rocket: faRocket,
  robot: faRobot,
  meteor: faMeteor,
  globe: faGlobe,
  anchor: faAnchor,
  crosshairs: faCrosshairs,
  bomb: faBomb,
  paw: faPaw,
  campground: faCampground,
  server: faServer,
  terminal: faTerminal,
};

/** What a tile shows: its icon, or up to `letters` of its initials. */
export function TileGlyph({ tile, letters = 2 }: { tile: Tile; letters?: number }) {
  if (tile.icon) return <FontAwesomeIcon icon={TILE_ICON_DEFS[tile.icon]} />;
  return <>{[...tile.initials].slice(0, letters).join('')}</>;
}

/** A tile on its own (the overview, the console, the editor's preview), `size` pixels square, for sighted users only. */
export function TileSquare({ tile, size, className = '' }: { tile: Tile; size: number; className?: string }) {
  return (
    <span
      className={`xylo-server-tile ${className}`}
      aria-hidden
      style={{ background: tile.background, '--xylo-tile-size': `${size}px` } as CSSProperties}
    >
      <TileGlyph tile={tile} />
    </span>
  );
}

/**
 * A server's small tile and its name as a heading (the console's command bar): the user's own name when there is
 * one, the real one in the heading's title.
 */
export function TileHeading({
  server,
  size,
  className,
}: {
  server: { uuid: string; name: string };
  size: number;
  className: string;
}) {
  const { t } = useExtTranslations();
  const tile = useServerTile(server);
  return (
    <>
      <TileSquare tile={tile} size={size} />
      <h1
        className={className}
        title={tile.custom ? t('tiles.titled', { name: tile.label, real: server.name }) : server.name}
      >
        {tile.label}
      </h1>
    </>
  );
}
