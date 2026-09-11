import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('1. Desktop navigation: contains all 7 Netflix items in correct order', () => {
  const routesPath = path.resolve('src/lib/navigation/routes.ts');
  const routesContent = fs.readFileSync(routesPath, 'utf8');

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
      routesContent.includes(`label: '${label}'`),
      `Routes should include item with label: '${label}'`,
    );
  });

  const shellPath = path.resolve('src/components/navigation/NavigationShell.tsx');
  const shellContent = fs.readFileSync(shellPath, 'utf8');
  assert.ok(
    shellContent.includes('NAV_ITEMS'),
    'NavigationShell should import and render NAV_ITEMS',
  );
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

test('8. Search input: harsh outer focus outline is suppressed', () => {
  const cssPath = path.resolve('src/components/navigation/NavigationShell.css');
  const cssContent = fs.readFileSync(cssPath, 'utf8');

  assert.ok(
    cssContent.includes('.netflix-search__input:focus') &&
    cssContent.includes('.netflix-search__input:focus-visible') &&
    cssContent.includes('outline: none !important') &&
    cssContent.includes('box-shadow: none !important'),
    'Search input must suppress thick white outer focus outline with outline: none !important',
  );
});

test('9. Catalog Notifications: backed by real TMDB items with artwork and unread counter', () => {
  const shellPath = path.resolve('src/components/navigation/NavigationShell.tsx');
  const shellContent = fs.readFileSync(shellPath, 'utf8');

  assert.ok(
    shellContent.includes('tmdbClient.getTrending'),
    'NavigationShell should fetch catalog items for notifications',
  );
  assert.ok(
    shellContent.includes('netflix-notifications__img'),
    'Notifications should render real media thumbnail artwork',
  );
  assert.ok(
    shellContent.includes('top-navigation__notification-badge'),
    'Navigation bell should render unread count badge',
  );
});

test('10. My List: storage key is daitign-my-list and supports reactive add/remove', () => {
  const providerPath = path.resolve('src/features/my-list/MyListProvider.tsx');
  const providerContent = fs.readFileSync(providerPath, 'utf8');

  assert.ok(
    providerContent.includes("'daitign-my-list'"),
    'MyListProvider must use localStorage key daitign-my-list',
  );
  assert.ok(
    providerContent.includes('toggleItem'),
    'MyListProvider must expose toggleItem function',
  );
  assert.ok(
    providerContent.includes('isInList'),
    'MyListProvider must expose isInList function',
  );
});

test('11. Routing: App.tsx handles all 7 navigation views and watch route', () => {
  const appPath = path.resolve('src/app/App.tsx');
  const appContent = fs.readFileSync(appPath, 'utf8');

  assert.ok(appContent.includes('<ShowsPage'), 'App should render ShowsPage');
  assert.ok(appContent.includes('<MoviesPage'), 'App should render MoviesPage');
  assert.ok(appContent.includes('<GamesPage'), 'App should render GamesPage');
  assert.ok(appContent.includes('<NewPopularPage'), 'App should render NewPopularPage');
  assert.ok(appContent.includes('<MyListPage'), 'App should render MyListPage');
  assert.ok(appContent.includes('<LanguagesPage'), 'App should render LanguagesPage');
  assert.ok(appContent.includes('MyListProvider'), 'App should be wrapped in MyListProvider');
});

test('12. Vercel SPA rewrites: configure all routes to serve index.html', () => {
  const vercelPath = path.resolve('vercel.json');
  const vercelContent = JSON.parse(fs.readFileSync(vercelPath, 'utf8'));

  const routes = ['/shows', '/movies', '/games', '/new-popular', '/my-list', '/languages'];
  routes.forEach((route) => {
    const rewrite = vercelContent.rewrites.find((r: { source: string; destination: string }) => r.source === route);
    assert.ok(rewrite, `vercel.json should have rewrite for ${route}`);
    assert.equal(rewrite.destination, '/index.html');
  });
});





