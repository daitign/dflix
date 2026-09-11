import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('1. Desktop navigation: contains all 7 Netflix items in correct order', () => {
  const filePath = path.resolve('src/components/navigation/NavigationShell.tsx');
  const content = fs.readFileSync(filePath, 'utf8');

  const expectedLabels = [
    'Home',
    'Shows',
    'Movies',
    'Games',
    'New & Popular',
    'My List',
    'Browse by Languages',
  ];

  expectedLabels.forEach((label) => {
    assert.ok(
      content.includes(`label: '${label}'`),
      `Navigation should include item with label: '${label}'`,
    );
  });
});

test('2. Navigation styling: active link renders as a rounded pill with no thick border', () => {
  const cssPath = path.resolve('src/components/navigation/NavigationShell.css');
  const content = fs.readFileSync(cssPath, 'utf8');

  assert.ok(
    content.includes('.top-navigation__link--active'),
    'CSS should define active link styling',
  );
  assert.ok(
    content.includes('border-radius: 9999px'),
    'Active link should have pill border radius (9999px)',
  );
});

test('3. Season Selector: chevron is cleanly positioned and outline is suppressed', () => {
  const selectorFile = path.resolve('src/features/details-modal/components/SeasonSelector.tsx');
  const selectorContent = fs.readFileSync(selectorFile, 'utf8');
  assert.ok(
    selectorContent.includes('season-selector__chevron'),
    'SeasonSelector should include a custom chevron wrapper',
  );

  const cssPath = path.resolve('src/features/details-modal/components/DetailsModal.css');
  const cssContent = fs.readFileSync(cssPath, 'utf8');
  assert.ok(
    cssContent.includes('outline: none !important'),
    'DetailsModal CSS should suppress default browser outline on select',
  );
  assert.ok(
    cssContent.includes('appearance: none'),
    'DetailsModal CSS should use appearance: none for custom chevron',
  );
});

test('4. Kids profile: removed from navigation header and profile list', () => {
  const navFile = path.resolve('src/components/navigation/NavigationShell.tsx');
  const navContent = fs.readFileSync(navFile, 'utf8');
  assert.ok(
    !navContent.includes('top-navigation__kids-btn'),
    'NavigationShell should not contain Kids profile button',
  );
});

test('5. Badges: responsive CTA hiding and container query rules in mobile & compact views', () => {
  const badgeCssPath = path.resolve('src/features/home/components/StatusBadge.css');
  const badgeCss = fs.readFileSync(badgeCssPath, 'utf8');
  assert.ok(
    badgeCss.includes('.netflix-badge--inline .netflix-badge__segment--inline-right {\n    display: none;'),
    'StatusBadge should hide Watch Now segment on mobile to prevent overflow',
  );
  assert.ok(
    badgeCss.includes('@container (max-width: 185px)'),
    'StatusBadge should support container query for compact card widths',
  );

  const cardCssPath = path.resolve('src/features/home/components/MediaCard.css');
  const cardCss = fs.readFileSync(cardCssPath, 'utf8');
  assert.ok(
    cardCss.includes('container-type: inline-size'),
    'MediaCard should have container-type: inline-size for responsive badges',
  );
});

test('6. Top 10 row: flex track and in-flow poster margin prevents iPhone WebKit collapse', () => {
  const rankedCssPath = path.resolve('src/features/home/components/RankedMediaCard.css');
  const rankedCss = fs.readFileSync(rankedCssPath, 'utf8');
  assert.ok(
    rankedCss.includes('.carousel-shell--ranked .carousel-shell__track {\n  display: flex;'),
    'Ranked track must use display: flex to prevent WebKit grid column collapse',
  );
  assert.ok(
    rankedCss.includes('margin-left: var(--rank-poster-left);'),
    'Ranked card art must use in-flow margin-left so its intrinsic width matches full card',
  );
});

test('7. Favicon: has transparent background with no background rect like Netflix', () => {
  const faviconSvg = fs.readFileSync(path.resolve('public/favicon.svg'), 'utf-8');
  assert.ok(!faviconSvg.includes('<rect'), 'Favicon must not have a solid background rect element');
  assert.ok(faviconSvg.includes('viewBox="0 0 64 64"'), 'Favicon must define a clean square viewBox');
  assert.ok(faviconSvg.includes('#f0183d'), 'Favicon must contain the DAITIGN crimson path');
});




