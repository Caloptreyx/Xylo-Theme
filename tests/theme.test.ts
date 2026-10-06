import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { contrastRatio, hsl, toHexColor } from '../frontend/src/lib/color.ts';
import {
  accentInk,
  applyPreset,
  buildCss,
  contrastIssues,
  DEFAULT_THEME,
  generatePalette,
  normalizeTheme,
  PRESETS,
  sameTheme,
  themeAttributes,
} from '../frontend/src/lib/theme.ts';

describe('normalizeTheme', () => {
  test('keeps a valid theme as is and drops unknown fields', () => {
    const theme = normalizeTheme({ ...DEFAULT_THEME, accent: '#ABCDEF', extra: 'x', __proto__: { y: 1 } });
    assert.equal(theme.accent, '#abcdef');
    assert.equal('extra' in theme, false);
    assert.deepEqual(Object.keys(theme).sort(), Object.keys(DEFAULT_THEME).sort());
  });

  test('anything but an object is the fallback', () => {
    for (const raw of [null, undefined, 'x', 3, [DEFAULT_THEME]]) {
      assert.ok(sameTheme(normalizeTheme(raw), DEFAULT_THEME));
    }
  });

  test('refuses colours that are not #rrggbb, so nothing else reaches the stylesheet', () => {
    for (const bad of ['red', '#fff', 'rgb(1,2,3)', '#1234567', '#12345g', '#123456;}', 12]) {
      assert.equal(normalizeTheme({ accent: bad }).accent, DEFAULT_THEME.accent, String(bad));
    }
  });

  test('optional colours may be empty, the required ones may not', () => {
    const theme = normalizeTheme({ success: '', lightText: '', accent: '' }, { ...DEFAULT_THEME, success: '#00ff00' });
    assert.equal(theme.success, '');
    assert.equal(theme.lightText, '');
    assert.equal(theme.accent, DEFAULT_THEME.accent);
  });

  test('clamps and rounds numbers, ignoring non numbers', () => {
    const theme = normalizeTheme({ radius: 99, blur: -4, surfaceOpacity: 10, uiScale: 101.6, glow: '50', patternOpacity: NaN });
    assert.equal(theme.radius, 32);
    assert.equal(theme.blur, 0);
    assert.equal(theme.surfaceOpacity, 30);
    assert.equal(theme.uiScale, 102);
    assert.equal(theme.glow, DEFAULT_THEME.glow);
    assert.equal(theme.patternOpacity, DEFAULT_THEME.patternOpacity);
  });

  test('choices outside their list fall back', () => {
    const theme = normalizeTheme({ backdrop: 'lava', sidebar: 'floating"]{}', font: 'comic', motion: 'none' });
    assert.equal(theme.backdrop, DEFAULT_THEME.backdrop);
    assert.equal(theme.sidebar, DEFAULT_THEME.sidebar);
    assert.equal(theme.font, DEFAULT_THEME.font);
    assert.equal(theme.motion, 'none');
  });

  test('background images must be http(s) or root relative without characters that end url("...")', () => {
    const ok = ['https://cdn.example.com/a.png', 'http://x.y/z.webp?a=1&b=2', '/assets/bg.jpg', ''];
    for (const url of ok) assert.equal(normalizeTheme({ backgroundImage: url }).backgroundImage, url);
    const bad = [
      'javascript:alert(1)',
      'data:image/png;base64,AAAA',
      '//evil.example/a.png',
      'https://x.y/a.png") ; body{display:none',
      "https://x.y/a'.png",
      'https://x.y/a b.png',
      'https://x.y/a\\.png',
      'relative.png',
      `https://x.y/${'a'.repeat(2048)}`,
    ];
    for (const url of bad) {
      assert.equal(normalizeTheme({ backgroundImage: url }).backgroundImage, '', url.slice(0, 40));
    }
  });
});

describe('presets', () => {
  test('every preset holds only values normalizeTheme() keeps', () => {
    for (const preset of PRESETS) {
      const applied = applyPreset(DEFAULT_THEME, preset.look);
      for (const [key, value] of Object.entries(preset.look)) {
        assert.equal(applied[key as keyof typeof applied], value, `${preset.id}.${key}`);
      }
    }
  });

  test('a preset replaces the look and keeps the site fields', () => {
    const site = normalizeTheme({
      ...DEFAULT_THEME,
      sidebar: 'docked',
      greeting: false,
      homePage: false,
      serverOverview: false,
      backgroundImage: '/bg.png',
      success: '#00ff00',
      uiScale: 110,
    });
    const mono = PRESETS.find((preset) => preset.id === 'mono');
    assert.ok(mono);
    const applied = applyPreset(site, mono.look);
    assert.equal(applied.accent, mono.look.accent);
    assert.equal(applied.sidebar, 'rail');
    assert.equal(applied.greeting, false);
    assert.equal(applied.homePage, false);
    assert.equal(applied.serverOverview, false);
    assert.equal(applied.backgroundImage, '/bg.png');
    assert.equal(applied.success, '#00ff00');
    assert.equal(applied.uiScale, 110);
  });

  test('every preset passes the contrast checks', () => {
    for (const preset of PRESETS) {
      assert.deepEqual(contrastIssues(applyPreset(DEFAULT_THEME, preset.look)), [], preset.id);
    }
  });

  test('generated palettes pass the contrast checks around the whole hue circle', () => {
    for (let hue = 0; hue < 360; hue += 15) {
      const theme = normalizeTheme({ ...DEFAULT_THEME, ...generatePalette(hue) });
      assert.deepEqual(contrastIssues(theme), [], `hue ${hue}`);
    }
  });
});

describe('accentInk', () => {
  test('a white accent gets dark labels, a deep one white', () => {
    assert.equal(accentInk({ ...DEFAULT_THEME, accent: '#fafafa', buttonStyle: 'solid', navStyle: 'bar' }), '#0b0b10');
    assert.equal(accentInk({ ...DEFAULT_THEME, accent: '#4c1d95', buttonStyle: 'solid', navStyle: 'bar' }), '#ffffff');
  });

  test('with a gradient both stops count: a light second stop turns the labels dark', () => {
    const deep = { ...DEFAULT_THEME, accent: '#4c1d95', accent2: '#fde68a', navStyle: 'bar' as const };
    assert.equal(accentInk({ ...deep, buttonStyle: 'solid' }), '#ffffff');
    assert.equal(accentInk({ ...deep, buttonStyle: 'gradient' }), '#0b0b10');
  });
});

describe('contrastIssues', () => {
  test('flags text that does not read on the surface', () => {
    const issues = contrastIssues(normalizeTheme({ ...DEFAULT_THEME, text: '#2a2a35' }));
    assert.ok(issues.some((issue) => issue.pair === 'text' && issue.ratio < 4.5));
  });
});

describe('buildCss', () => {
  test('repaints the accent scale and both schemes', () => {
    const css = buildCss({ ...DEFAULT_THEME, accent: '#7c5cff', background: '#09090f' });
    assert.match(css, /html:root\{[^}]*--mantine-color-blue-6:#7c5cff;/);
    assert.match(css, /html:root\[data-mantine-color-scheme="dark"\]\{[^}]*--mantine-color-body:#09090f;/);
    assert.match(css, /html:root\[data-mantine-color-scheme="light"\]\{[^}]*--mantine-color-text:/);
  });

  test('status colours, the background image and the interface size only when set', () => {
    const plain = buildCss(DEFAULT_THEME);
    assert.doesNotMatch(plain, /--mantine-color-green-6|background-image|font-size/);
    const set = buildCss(normalizeTheme({ ...DEFAULT_THEME, success: '#22c55e', backgroundImage: '/bg.png', uiScale: 90 }));
    assert.match(set, /--mantine-color-green-6:#22c55e;/);
    assert.match(set, /--color-server-status-running:#22c55e;/);
    assert.match(set, /url\("\/bg\.png"\)/);
    assert.match(set, /html:root\{font-size:90%;\}/);
  });

  test('density scales Mantine spacing, comfortable leaves it alone', () => {
    assert.doesNotMatch(buildCss(DEFAULT_THEME), /--mantine-spacing-/);
    assert.match(buildCss({ ...DEFAULT_THEME, density: 'compact' }), /--mantine-spacing-md:0\.8rem;/);
  });

  test("the panel font option keeps core's font", () => {
    assert.doesNotMatch(buildCss({ ...DEFAULT_THEME, font: 'panel', headingFont: 'panel' }), /--mantine-font-family:/);
    assert.match(buildCss({ ...DEFAULT_THEME, font: 'inter' }), /--mantine-font-family:'Inter Variable'/);
    assert.match(buildCss({ ...DEFAULT_THEME, font: 'geist' }), /--mantine-font-family:'Geist Variable'/);
  });

  test('a hostile saved theme cannot break out of the stylesheet', () => {
    const css = buildCss(
      normalizeTheme({
        accent: '#fff;}body{display:none}',
        backgroundImage: 'https://x.y/a.png");}*{display:none}/*',
        font: "inter';}",
      }),
    );
    assert.doesNotMatch(css, /display:none/);
  });
});

describe('themeAttributes', () => {
  test('motion none turns off transitions, lift and the drift', () => {
    const attrs = themeAttributes({ ...DEFAULT_THEME, motion: 'none' });
    assert.equal(attrs.xyloTransition, 'none');
    assert.equal(attrs.xyloLift, 'off');
    assert.equal(attrs.xyloAnimate, 'off');
  });

  test('subtle motion keeps transitions but stops the drift', () => {
    const attrs = themeAttributes({ ...DEFAULT_THEME, motion: 'subtle' });
    assert.equal(attrs.xyloTransition, DEFAULT_THEME.pageTransition);
    assert.equal(attrs.xyloAnimate, 'off');
  });

  test('a background image replaces the backdrop; an invisible texture is none', () => {
    const attrs = themeAttributes({ ...DEFAULT_THEME, backgroundImage: '/bg.png', patternOpacity: 0 });
    assert.equal(attrs.xyloBackdrop, 'image');
    assert.equal(attrs.xyloPattern, 'none');
  });
});

describe('colour helpers', () => {
  test('toHexColor reads the formats people paste', () => {
    assert.equal(toHexColor('#ABC'), '#aabbcc');
    assert.equal(toHexColor('abc'), '#aabbcc');
    assert.equal(toHexColor(' 7C5CFF '), '#7c5cff');
    assert.equal(toHexColor('rgb(124, 92, 255)'), '#7c5cff');
    assert.equal(toHexColor('rgba(124 92 255 / 50%)'), '#7c5cff');
    assert.equal(toHexColor('rgb(300, 0, 0)'), null);
    assert.equal(toHexColor('tomato'), null);
  });

  test('hsl wraps hues and hits the primaries', () => {
    assert.equal(hsl(0, 100, 50), '#ff0000');
    assert.equal(hsl(480, 100, 50), '#00ff00');
    assert.equal(hsl(-120, 100, 50), '#0000ff');
  });

  test('contrastRatio is symmetric and spans 1 to 21', () => {
    assert.equal(contrastRatio('#000000', '#ffffff'), 21);
    assert.equal(contrastRatio('#ffffff', '#000000'), 21);
    assert.equal(contrastRatio('#7c5cff', '#7c5cff'), 1);
  });
});

describe('sameTheme', () => {
  test('ignores key order and notices any field', () => {
    const reversed = Object.fromEntries(Object.entries(DEFAULT_THEME).reverse()) as typeof DEFAULT_THEME;
    assert.ok(sameTheme(reversed, DEFAULT_THEME));
    assert.ok(!sameTheme({ ...DEFAULT_THEME, greeting: false }, DEFAULT_THEME));
  });
});
