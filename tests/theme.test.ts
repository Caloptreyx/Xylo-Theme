import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { contrastRatio, hsl, toHexColor } from '../frontend/src/lib/color.ts';
import {
  accentInk,
  applyPreset,
  buildCss,
  contrastIssues,
  CONSOLE_METRICS,
  DEFAULT_THEME,
  generatePalette,
  MAX_CUSTOM_PRESETS,
  MAX_SITE_COMMAND,
  MAX_SITE_COMMANDS,
  MAX_OVERVIEW_ACTIVITY,
  MIN_OVERVIEW_ACTIVITY,
  NAMED_TERMINALS,
  normalizeTheme,
  OVERVIEW_SECTIONS,
  PRESETS,
  sameTheme,
  TERMINAL_SCHEME_GROUPS,
  TERMINAL_SCHEMES,
  terminalPalette,
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

  test("server page fields: today's look by default", () => {
    assert.deepEqual(DEFAULT_THEME.overviewSections, ['usage', 'activity', 'connect', 'glance']);
    assert.equal(DEFAULT_THEME.overviewLayout, 'split');
    assert.equal(DEFAULT_THEME.overviewUsage, 'bars');
    assert.equal(DEFAULT_THEME.overviewActivityCount, 8);
    assert.equal(DEFAULT_THEME.overviewHeader, 'plain');
    assert.equal(DEFAULT_THEME.overviewDescription, true);
  });

  test('overview blocks: allow listed, each once, in the order given; none is a choice', () => {
    assert.deepEqual(
      normalizeTheme({ overviewSections: ['glance', 'usage', 'chat', 'glance', 3, null, 'activity'] }).overviewSections,
      ['glance', 'usage', 'activity'],
    );
    assert.deepEqual(normalizeTheme({ overviewSections: [] }).overviewSections, []);
    assert.deepEqual(normalizeTheme({ overviewSections: 'usage' }).overviewSections, [...OVERVIEW_SECTIONS]);
    assert.deepEqual(normalizeTheme({ overviewSections: { 0: 'usage' } }).overviewSections, [...OVERVIEW_SECTIONS]);
  });

  test('overview layout, usage and header are allow listed', () => {
    assert.equal(normalizeTheme({ overviewLayout: 'wide' }).overviewLayout, 'wide');
    assert.equal(normalizeTheme({ overviewLayout: 'stacked' }).overviewLayout, 'stacked');
    assert.equal(normalizeTheme({ overviewLayout: 'grid"]' }).overviewLayout, 'split');
    assert.equal(normalizeTheme({ overviewUsage: 'graphs' }).overviewUsage, 'graphs');
    assert.equal(normalizeTheme({ overviewUsage: 'numbers' }).overviewUsage, 'numbers');
    assert.equal(normalizeTheme({ overviewUsage: 'pie' }).overviewUsage, 'bars');
    assert.equal(normalizeTheme({ overviewHeader: 'banner' }).overviewHeader, 'banner');
    assert.equal(normalizeTheme({ overviewHeader: 'hero' }).overviewHeader, 'plain');
  });

  test('overview activity entries: whole numbers clamped to 3..20', () => {
    assert.equal(normalizeTheme({ overviewActivityCount: 12 }).overviewActivityCount, 12);
    assert.equal(normalizeTheme({ overviewActivityCount: 12.6 }).overviewActivityCount, 13);
    assert.equal(normalizeTheme({ overviewActivityCount: 0 }).overviewActivityCount, MIN_OVERVIEW_ACTIVITY);
    assert.equal(normalizeTheme({ overviewActivityCount: 500 }).overviewActivityCount, MAX_OVERVIEW_ACTIVITY);
    assert.equal(normalizeTheme({ overviewActivityCount: '12' }).overviewActivityCount, 8);
    assert.equal(normalizeTheme({ overviewActivityCount: Number.NaN }).overviewActivityCount, 8);
  });

  test('overview description is a flag', () => {
    assert.equal(normalizeTheme({ overviewDescription: false }).overviewDescription, false);
    assert.equal(normalizeTheme({ overviewDescription: 'no' }).overviewDescription, true);
  });

  test('console fields: scheme and frame allow listed, line height clamped, choice a flag', () => {
    assert.equal(normalizeTheme({ terminalScheme: 'dracula' }).terminalScheme, 'dracula');
    assert.equal(normalizeTheme({ terminalScheme: 'kanagawa' }).terminalScheme, 'kanagawa');
    assert.equal(normalizeTheme({ terminalScheme: 'matrix' }).terminalScheme, DEFAULT_THEME.terminalScheme);
    assert.equal(normalizeTheme({ terminalLineHeight: 400 }).terminalLineHeight, 180);
    assert.equal(normalizeTheme({ terminalLineHeight: 50 }).terminalLineHeight, 100);
    assert.equal(normalizeTheme({ terminalSkin: 'crt' }).terminalSkin, 'crt');
    assert.equal(normalizeTheme({ terminalSkin: 'crt"]{}' }).terminalSkin, 'card');
    assert.equal(normalizeTheme({ terminalUserChoice: false }).terminalUserChoice, false);
    assert.equal(normalizeTheme({ terminalUserChoice: 'no' }).terminalUserChoice, true);
  });

  test("console page fields: today's look by default, choices allow listed, flags flags", () => {
    assert.deepEqual(DEFAULT_THEME.consoleMetrics, [...CONSOLE_METRICS]);
    assert.equal(DEFAULT_THEME.consoleGraphs, 'area');
    assert.equal(DEFAULT_THEME.consoleInspector, 'right');
    assert.equal(DEFAULT_THEME.consoleInspectorOpen, true);
    assert.equal(DEFAULT_THEME.consoleDensity, 'comfortable');
    assert.equal(DEFAULT_THEME.consoleQuickCommands, true);
    assert.deepEqual(DEFAULT_THEME.consoleCommands, []);
    assert.equal(normalizeTheme({ consoleGraphs: 'bars' }).consoleGraphs, 'bars');
    assert.equal(normalizeTheme({ consoleGraphs: 'pie' }).consoleGraphs, 'area');
    assert.equal(normalizeTheme({ consoleInspector: 'left' }).consoleInspector, 'left');
    assert.equal(normalizeTheme({ consoleInspector: 'top"]{}' }).consoleInspector, 'right');
    assert.equal(normalizeTheme({ consoleDensity: 'spacious' }).consoleDensity, 'spacious');
    assert.equal(normalizeTheme({ consoleDensity: 'huge' }).consoleDensity, 'comfortable');
    assert.equal(normalizeTheme({ consoleInspectorOpen: false }).consoleInspectorOpen, false);
    assert.equal(normalizeTheme({ consoleInspectorOpen: 0 }).consoleInspectorOpen, true);
    assert.equal(normalizeTheme({ consoleQuickCommands: false }).consoleQuickCommands, false);
    assert.equal(normalizeTheme({ consoleQuickCommands: 'no' }).consoleQuickCommands, true);
  });

  test('console figures: allow listed, each once, in their own order; none is a choice', () => {
    assert.deepEqual(normalizeTheme({ consoleMetrics: ['netOut', 'cpu', 'gpu', 'cpu', 3, null] }).consoleMetrics, [
      'cpu',
      'netOut',
    ]);
    assert.deepEqual(normalizeTheme({ consoleMetrics: [] }).consoleMetrics, []);
    assert.deepEqual(normalizeTheme({ consoleMetrics: 'cpu' }).consoleMetrics, [...CONSOLE_METRICS]);
  });

  test('site commands: strings only, control characters dropped, trimmed, 1 to 200 characters, unique, at most 12', () => {
    const theme = normalizeTheme({
      consoleCommands: [
        '  save-all ',
        'say\u0000 hi\n',
        'save-all',
        '',
        ' \u0007 ',
        42,
        { command: 'x' },
        'x'.repeat(MAX_SITE_COMMAND),
        'y'.repeat(MAX_SITE_COMMAND + 1),
        ...Array.from({ length: 20 }, (_, i) => `cmd ${i}`),
      ],
    });
    assert.equal(theme.consoleCommands.length, MAX_SITE_COMMANDS);
    assert.deepEqual(theme.consoleCommands.slice(0, 4), ['save-all', 'say hi', 'x'.repeat(MAX_SITE_COMMAND), 'cmd 0']);
    assert.deepEqual(normalizeTheme({ consoleCommands: 'list' }).consoleCommands, []);
  });

  test('sign in links: a label and a safe address each, a known icon or link, at most four', () => {
    const theme = normalizeTheme({
      loginLinks: [
        { label: ' Demo login: demo / zorondemo ', url: '/auth/login', icon: 'nope' },
        { label: 'Docs', url: 'javascript:alert(1)', icon: 'docs' },
        { label: '', url: 'https://example.com' },
        { label: 'Quote', url: 'https://x.y/a") ;b' },
        { label: 'GitHub', url: 'https://github.com/Caloptreyx/Zoron-Theme', icon: 'github', extra: 1 },
        'https://example.com',
      ],
    });
    assert.deepEqual(theme.loginLinks, [
      { label: 'Demo login: demo / zorondemo', url: '/auth/login', icon: 'link' },
      { label: 'GitHub', url: 'https://github.com/Caloptreyx/Zoron-Theme', icon: 'github' },
    ]);
    const many = Array.from({ length: 6 }, (_, i) => ({ label: `L${i}`, url: `/p${i}` }));
    assert.equal(normalizeTheme({ loginLinks: many }).loginLinks.length, 4);
    assert.equal(normalizeTheme({ loginLinks: [{ label: 'x'.repeat(60), url: '/x' }] }).loginLinks[0].label.length, 48);
    assert.ok(!sameTheme(theme, normalizeTheme({ loginLinks: [theme.loginLinks[0]] })));
    assert.ok(sameTheme(theme, normalizeTheme(JSON.parse(JSON.stringify(theme)))));
  });

  test('custom presets: valid unique names, normalized looks, at most twelve', () => {
    const look = { ...PRESETS[1].look, accent: 'red;}', extra: 1, customPresets: [{ name: 'nested', look: {} }] };
    const theme = normalizeTheme({
      customPresets: [
        { name: '  Night\u0000 ', look },
        { name: 'Night', look: PRESETS[2].look },
        { name: '', look },
        { name: 'x'.repeat(33), look },
        { name: 'No look' },
        'Morning',
        ...Array.from({ length: 20 }, (_, i) => ({ name: `p${i}`, look })),
      ],
    });
    assert.equal(theme.customPresets.length, MAX_CUSTOM_PRESETS);
    const [first] = theme.customPresets;
    assert.equal(first.name, 'Night');
    assert.equal(first.look.accent, DEFAULT_THEME.accent);
    assert.equal(first.look.backdrop, PRESETS[1].look.backdrop);
    assert.deepEqual(Object.keys(first.look).sort(), Object.keys(PRESETS[0].look).sort());
    assert.deepEqual(normalizeTheme({ customPresets: 'x' }).customPresets, []);
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

  test('a preset keeps the saved custom presets', () => {
    const site = normalizeTheme({ customPresets: [{ name: 'Mine', look: PRESETS[3].look }] });
    assert.equal(applyPreset(site, PRESETS[1].look).customPresets[0].name, 'Mine');
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
    assert.equal(attrs.zoronTransition, 'none');
    assert.equal(attrs.zoronLift, 'off');
    assert.equal(attrs.zoronAnimate, 'off');
  });

  test('subtle motion keeps transitions but stops the drift', () => {
    const attrs = themeAttributes({ ...DEFAULT_THEME, motion: 'subtle' });
    assert.equal(attrs.zoronTransition, DEFAULT_THEME.pageTransition);
    assert.equal(attrs.zoronAnimate, 'off');
  });

  test('a background image replaces the backdrop; an invisible texture is none', () => {
    const attrs = themeAttributes({ ...DEFAULT_THEME, backgroundImage: '/bg.png', patternOpacity: 0 });
    assert.equal(attrs.zoronBackdrop, 'image');
    assert.equal(attrs.zoronPattern, 'none');
  });

  test('the terminal frame is its own attribute', () => {
    assert.equal(themeAttributes(DEFAULT_THEME).zoronTermSkin, 'card');
    assert.equal(themeAttributes({ ...DEFAULT_THEME, terminalSkin: 'neon' }).zoronTermSkin, 'neon');
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

  test('compares the console lists by value, order included', () => {
    const a = normalizeTheme({ consoleCommands: ['list', 'save-all'], consoleMetrics: ['cpu'] });
    assert.ok(sameTheme(a, normalizeTheme({ consoleCommands: ['list', 'save-all'], consoleMetrics: ['cpu'] })));
    assert.ok(!sameTheme(a, normalizeTheme({ consoleCommands: ['save-all', 'list'], consoleMetrics: ['cpu'] })));
    assert.ok(!sameTheme(a, normalizeTheme({ consoleCommands: ['list', 'save-all'], consoleMetrics: ['disk'] })));
  });

  test('compares custom presets by value', () => {
    const a = normalizeTheme({ customPresets: [{ name: 'A', look: PRESETS[1].look }] });
    const b = normalizeTheme({ customPresets: [{ name: 'A', look: PRESETS[1].look }] });
    assert.ok(sameTheme(a, b));
    assert.ok(!sameTheme(a, normalizeTheme({ customPresets: [{ name: 'A', look: PRESETS[2].look }] })));
    assert.ok(!sameTheme(a, normalizeTheme({ customPresets: [{ name: 'B', look: PRESETS[1].look }] })));
  });
});

describe('terminalPalette', () => {
  test("'panel' keeps core's colours: no palette, no variables", () => {
    const theme = normalizeTheme({ terminalScheme: 'panel' });
    assert.equal(terminalPalette(theme, true), null);
    assert.equal(themeAttributes(theme).zoronTerminal, 'panel');
    assert.ok(!buildCss(theme).includes('--zoron-term-bg'));
  });

  test('a named scheme is the same in both modes', () => {
    const theme = normalizeTheme({ terminalScheme: 'nord' });
    assert.deepEqual(terminalPalette(theme, false), terminalPalette(theme, true));
    assert.equal(terminalPalette(theme, true)?.background, '#2e3440');
    assert.equal(themeAttributes(theme).zoronTerminal, 'custom');
  });

  test('every named scheme has sixteen colours, and the scheme groups list each scheme once', () => {
    for (const [name, palette] of Object.entries(NAMED_TERMINALS)) {
      assert.equal(palette.ansi.length, 16, name);
      // Solarized Light's published text is the lowest, at 4.1:1
      assert.ok(contrastRatio(palette.foreground, palette.background) >= 4, name);
    }
    const grouped = TERMINAL_SCHEME_GROUPS.flatMap((group) => [...group.schemes]);
    assert.deepEqual([...grouped].sort(), [...TERMINAL_SCHEMES].sort());
  });

  test('the retro screens stay readable in every colour but black', () => {
    for (const name of ['phosphor', 'amber'] as const) {
      const palette = NAMED_TERMINALS[name];
      palette.ansi.slice(1).forEach((colour, i) => {
        assert.ok(contrastRatio(colour, palette.background) >= 4.5, `${name} ${i + 1}`);
      });
    }
  });

  test("the flush frame leaves 'theme' on the canvas and a named scheme on its own background", () => {
    assert.match(buildCss(DEFAULT_THEME), /--zoron-term-flush:transparent;/);
    assert.match(buildCss(normalizeTheme({ terminalScheme: 'githubLight' })), /--zoron-term-flush:#ffffff;/);
  });

  test('the crt glow lights a dark screen only, whatever the mode', () => {
    const glow = (css: string, scheme: 'dark' | 'light') =>
      css.match(new RegExp(`\\[data-mantine-color-scheme="${scheme}"\\]\\{[^}]*--zoron-term-glow:([^;]*);`))?.[1];
    const themed = buildCss(DEFAULT_THEME);
    assert.match(glow(themed, 'dark') ?? '', /currentColor/);
    assert.equal(glow(themed, 'light'), 'none');
    const light = buildCss(normalizeTheme({ terminalScheme: 'githubLight' }));
    assert.equal(glow(light, 'dark'), 'none');
    assert.match(glow(buildCss(normalizeTheme({ terminalScheme: 'panel' })), 'dark') ?? '', /currentColor/);
  });

  test("'theme' colours read on their background in both modes for every preset", () => {
    for (const preset of PRESETS) {
      for (const dark of [true, false]) {
        const palette = terminalPalette(applyPreset(DEFAULT_THEME, preset.look), dark);
        assert.ok(palette);
        assert.equal(palette.ansi.length, 16);
        assert.ok(contrastRatio(palette.foreground, palette.background) >= 4.5, preset.id);
        for (const i of [1, 2, 3, 4, 5, 6, 9, 10, 11, 12, 13, 14]) {
          const ratio = contrastRatio(palette.ansi[i], palette.background);
          assert.ok(ratio >= 4.5, `${preset.id} ${dark ? 'dark' : 'light'} ${i}: ${ratio}`);
        }
      }
    }
  });

  test("'theme' takes the status colours when set", () => {
    const palette = terminalPalette(normalizeTheme({ danger: '#ff4d4f', success: '#52c41a' }), true);
    assert.equal(palette?.ansi[1], '#ff4d4f');
    assert.equal(palette?.ansi[2], '#52c41a');
  });
});
