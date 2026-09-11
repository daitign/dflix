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

test('7. Favicon & Profile Avatar: uses the D/ emblem across browser tabs and profile menu', () => {
  const faviconSvg = fs.readFileSync(path.resolve('public/favicon.svg'), 'utf-8');
  assert.ok(faviconSvg.includes('viewBox="0 0 64 64"'), 'Favicon must define a clean square viewBox');
  assert.ok(fs.existsSync(path.resolve('public/favicon.png')), 'public/favicon.png must exist');
  assert.ok(fs.existsSync(path.resolve('public/profile-avatar.png')), 'public/profile-avatar.png must exist');

  const navShell = fs.readFileSync(path.resolve('src/components/navigation/NavigationShell.tsx'), 'utf-8');
  assert.ok(navShell.includes('src="/profile-avatar.png"'), 'NavigationShell must use profile-avatar.png for user avatar');
  assert.ok(navShell.includes('<span>DAITIGN</span>'), 'NavigationShell profile popover must display DAITIGN as profile name');
  assert.ok(!navShell.includes('<span>User</span>'), 'NavigationShell profile popover must not display User');

  const html = fs.readFileSync(path.resolve('index.html'), 'utf-8');
  assert.ok(html.includes('href="/favicon.svg"'), 'index.html must reference favicon.svg');
  assert.ok(html.includes('href="/favicon.png"'), 'index.html must reference favicon.png');
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

test('13. CategoryHeader: renders page heading and Netflix-style Genres dropdown button', () => {
  const compPath = path.resolve('src/components/navigation/CategoryHeader.tsx');
  const compContent = fs.readFileSync(compPath, 'utf8');

  assert.ok(compContent.includes('category-header__title'), 'CategoryHeader should render category title');
  assert.ok(compContent.includes('category-header__button'), 'CategoryHeader should render Genres button');
  assert.ok(compContent.includes('category-header__popover'), 'CategoryHeader should render dropdown popover');
  assert.ok(compContent.includes('category-header__caret'), 'CategoryHeader should render downward caret');

  const cssPath = path.resolve('src/components/navigation/CategoryHeader.css');
  const cssContent = fs.readFileSync(cssPath, 'utf8');

  assert.ok(cssContent.includes('position: sticky'), 'CategoryHeader must be sticky below top nav');
  assert.ok(cssContent.includes('border: 1px solid rgba(255, 255, 255, 0.85)'), 'Genres button must have crisp 1px border');
  assert.ok(cssContent.includes('grid-template-columns: repeat(3'), 'Popover must use 3-column layout on desktop');
});

test('14. ShowsPage: defines TV_GENRES and mounts CategoryHeader with TV Shows title', () => {
  const showsPath = path.resolve('src/features/shows/ShowsPage.tsx');
  const showsContent = fs.readFileSync(showsPath, 'utf8');

  assert.ok(showsContent.includes('CategoryHeader'), 'ShowsPage must mount CategoryHeader');
  assert.ok(showsContent.includes('title="TV Shows"'), 'ShowsPage must have title TV Shows matching Netflix');
  assert.ok(showsContent.includes('TV_GENRES'), 'ShowsPage must define TV_GENRES');
  assert.ok(showsContent.includes("name: 'Action & Adventure'"), 'TV_GENRES should include Action & Adventure');
  assert.ok(showsContent.includes("name: 'Korean Series'"), 'TV_GENRES should include Korean Series');
  assert.ok(showsContent.includes("name: 'Comedies'"), 'TV_GENRES should include Comedies');
  assert.ok(showsContent.includes("name: 'Anime Series'"), 'TV_GENRES should include Anime Series');
});

test('15. MoviesPage: defines MOVIE_GENRES and mounts CategoryHeader with Movies title', () => {
  const moviesPath = path.resolve('src/features/movies/MoviesPage.tsx');
  const moviesContent = fs.readFileSync(moviesPath, 'utf8');

  assert.ok(moviesContent.includes('CategoryHeader'), 'MoviesPage must mount CategoryHeader');
  assert.ok(moviesContent.includes('title="Movies"'), 'MoviesPage must have title Movies matching Netflix');
  assert.ok(moviesContent.includes('MOVIE_GENRES'), 'MoviesPage must define MOVIE_GENRES');
  assert.ok(moviesContent.includes("name: 'Action'"), 'MOVIE_GENRES should include Action');
  assert.ok(moviesContent.includes("name: 'Horror'"), 'MOVIE_GENRES should include Horror');
  assert.ok(moviesContent.includes("name: 'Thrillers'"), 'MOVIE_GENRES should include Thrillers');
  assert.ok(moviesContent.includes("name: 'Romantic Movies'"), 'MOVIE_GENRES should include Romantic Movies');
});

test('16. BrowseSkeleton: renders full-screen edge-to-edge loading cards and authentic hero billboard', () => {
  const skeletonPath = path.resolve('src/features/home/components/BrowseSkeleton.tsx');
  const skeletonContent = fs.readFileSync(skeletonPath, 'utf8');

  assert.ok(skeletonContent.includes('browse-loading__track'), 'BrowseSkeleton must render track for full-width cards');
  assert.ok(skeletonContent.includes('browse-loading__hero-copy'), 'BrowseSkeleton must render hero billboard copy skeleton');
  assert.ok(skeletonContent.includes('CARDS_PER_ROW = [0, 1, 2, 3, 4, 5]'), 'BrowseSkeleton must render 6 full-width cards per row');

  const cssPath = path.resolve('src/features/home/components/BrowseSkeleton.css');
  const cssContent = fs.readFileSync(cssPath, 'utf8');

  assert.ok(cssContent.includes('var(--items-per-page, 6)'), 'Skeleton card width must match responsive items-per-page');
  assert.ok(cssContent.includes('margin-inline: calc(var(--container-gutter) * -1)'), 'Track must bleed to screen edges');
  assert.ok(cssContent.includes('border-radius: 12px'), 'Standard skeleton cards must have 12px rounded corners');
});

test('17. Movie cards: borderless presentation matching Netflix with no outline stroke', () => {
  const mediaCardCss = fs.readFileSync(path.resolve('src/features/home/components/MediaCard.css'), 'utf8');
  assert.ok(mediaCardCss.includes('border: 0;'), 'MediaCard surface must have border: 0');
  assert.ok(!mediaCardCss.includes('border: 1px solid rgba(255, 255, 255'), 'MediaCard must not define white border');
  assert.ok(!mediaCardCss.includes('border-color: rgba(255, 255, 255'), 'MediaCard hover must not highlight border');

  const responsiveImgCss = fs.readFileSync(path.resolve('src/components/primitives/ResponsiveImage.css'), 'utf8');
  assert.ok(!responsiveImgCss.includes('border: 1px solid rgb(255 255 255'), 'ResponsiveImage must not have inset white stroke');

  const rankedCardCss = fs.readFileSync(path.resolve('src/features/home/components/RankedMediaCard.css'), 'utf8');
  assert.ok(rankedCardCss.includes('border: 0;'), 'Ranked card must have border: 0');
});

test('18. Search Results & My List: 2-column horizontal grid on iPhone and small screens', () => {
  const appCss = fs.readFileSync(path.resolve('src/app/App.css'), 'utf8');
  assert.ok(appCss.includes('.search-results__grid'), 'App.css must define search-results__grid');
  assert.ok(
    appCss.includes('grid-template-columns: repeat(2, 1fr)'),
    'Search results must enforce 2 columns on mobile/iPhone screen widths'
  );

  const myListCss = fs.readFileSync(path.resolve('src/features/my-list/MyListPage.css'), 'utf8');
  assert.ok(
    myListCss.includes('grid-template-columns: repeat(2, 1fr)'),
    'My List must enforce 2 columns on mobile/iPhone screen widths'
  );
});

test('19. Movie card badges: flush bottom baseline alignment with zero gap', () => {
  const mediaCardCss = fs.readFileSync(path.resolve('src/features/home/components/MediaCard.css'), 'utf8');
  assert.ok(
    mediaCardCss.includes('bottom: 0;') && mediaCardCss.includes('align-items: flex-end;'),
    'MediaCard badge container must be anchored to bottom: 0 with flex-end alignment'
  );
  assert.ok(
    mediaCardCss.includes('line-height: 0;') && mediaCardCss.includes('font-size: 0;'),
    'MediaCard surface must suppress line-height and font-size to prevent subpixel descender gaps'
  );
  assert.ok(
    mediaCardCss.includes('border-radius: 4px;'),
    'MediaCard surface must use authentic Netflix 4px corner radius so badges align flush'
  );

  const responsiveImgCss = fs.readFileSync(path.resolve('src/components/primitives/ResponsiveImage.css'), 'utf8');
  assert.ok(
    responsiveImgCss.includes('display: block;') && responsiveImgCss.includes('vertical-align: bottom;'),
    'ResponsiveImage picture and img elements must be display: block and vertical-align: bottom'
  );

  const badgeCss = fs.readFileSync(path.resolve('src/features/home/components/StatusBadge.css'), 'utf8');
  assert.ok(
    badgeCss.includes('margin: 0;') && badgeCss.includes('vertical-align: bottom;'),
    'StatusBadge must enforce margin: 0 and vertical-align: bottom'
  );

  const rankedCardCss = fs.readFileSync(path.resolve('src/features/home/components/RankedMediaCard.css'), 'utf8');
  assert.ok(
    rankedCardCss.includes('line-height: 0;') && rankedCardCss.includes('font-size: 0;'),
    'Ranked card art must suppress line-height and font-size to prevent bottom gaps'
  );
});

test('20. VIP luxury button: always-visible green-white button outside nav links redirecting to DAITIGN Vault shop', () => {
  const navShellPath = path.resolve('src/components/navigation/NavigationShell.tsx');
  const navShellContent = fs.readFileSync(navShellPath, 'utf8');

  assert.ok(
    navShellContent.includes('https://daitignvault.vercel.app/'),
    'NavigationShell must link to https://daitignvault.vercel.app/'
  );
  assert.ok(
    navShellContent.includes('top-navigation__vip-btn'),
    'NavigationShell must include top-navigation__vip-btn class'
  );
  assert.ok(
    navShellContent.includes('top-navigation__vip-suffix'),
    'NavigationShell must include responsive top-navigation__vip-suffix'
  );
  // Verify VIP button is inside top-navigation__actions and NOT inside top-navigation__links
  const linksBlock = navShellContent.slice(
    navShellContent.indexOf('top-navigation__links'),
    navShellContent.indexOf('</nav>')
  );
  assert.ok(
    !linksBlock.includes('top-navigation__vip-btn'),
    'VIP button must NOT be inside collapsible top-navigation__links'
  );
  const actionsBlock = navShellContent.slice(
    navShellContent.indexOf('top-navigation__actions')
  );
  assert.ok(
    actionsBlock.includes('top-navigation__vip-btn'),
    'VIP button must be placed inside top-navigation__actions to always display across all device sizes'
  );

  assert.ok(
    navShellContent.includes('netflix-browse-popover__item--vip'),
    'NavigationShell browse popover must include VIP luxury item'
  );

  const navCssPath = path.resolve('src/components/navigation/NavigationShell.css');
  const navCssContent = fs.readFileSync(navCssPath, 'utf8');

  assert.ok(
    navCssContent.includes('.top-navigation__vip-btn'),
    'NavigationShell.css must define top-navigation__vip-btn'
  );
  assert.ok(
    navCssContent.includes('animation: vip-luxury-glow'),
    'VIP luxury button must feature glowing highlight animation'
  );
  assert.ok(
    navCssContent.includes('0, 230, 118'),
    'VIP luxury button must use green luminous color palette'
  );
  assert.ok(
    navCssContent.includes('.top-navigation__vip-suffix'),
    'NavigationShell.css must handle responsive suffix for small devices'
  );
  assert.ok(
    navCssContent.includes('.netflix-browse-popover__item--vip'),
    'NavigationShell.css must define mobile popover VIP style'
  );
});

test('21. Footer branding: green-white shop button, Telegram group @daitignvault, and highlighted Contact Me (@stxngn) with Telegram icon', () => {
  const appPath = path.resolve('src/app/App.tsx');
  const appContent = fs.readFileSync(appPath, 'utf8');

  assert.ok(
    appContent.includes('https://t.me/daitignvault') && appContent.includes('@daitignvault'),
    'Footer questions must feature Telegram group link to @daitignvault'
  );
  assert.ok(
    appContent.includes('https://t.me/stxngn') && appContent.includes('@stxngn'),
    'Footer Contact Me must feature personal Telegram link to @stxngn'
  );
  assert.ok(
    appContent.includes('Contact Me (@stxngn)'),
    'Footer must render Contact Me (@stxngn)'
  );
  assert.ok(
    appContent.includes('name="telegram"'),
    'Footer must render Telegram icon'
  );
  assert.ok(
    appContent.includes('netflix-footer__link--highlight'),
    'Footer Contact Me must be highlighted with netflix-footer__link--highlight'
  );
  assert.ok(
    appContent.includes('netflix-footer__shop-btn') && appContent.includes('https://daitignvault.vercel.app/'),
    'Footer must replace service code with DAITIGN Vault shop button'
  );

  assert.ok(
    appContent.includes('© 2026-{currentYear} DAITIGN, Inc.'),
    'Footer copyright must be dynamic: © 2026-{currentYear} DAITIGN, Inc.'
  );
  assert.ok(
    !appContent.includes('Netflix, Inc.'),
    'Footer copyright must not contain Netflix, Inc.'
  );
  assert.ok(
    appContent.includes('Only on DAITIGN'),
    'Footer must render Only on DAITIGN link'
  );
  assert.ok(
    !appContent.includes('Only on Netflix'),
    'Footer must not contain Only on Netflix'
  );

  const iconPath = path.resolve('src/components/icons/Icon.tsx');
  const iconContent = fs.readFileSync(iconPath, 'utf8');
  assert.ok(
    iconContent.includes("'telegram'"),
    'Icon.tsx must support telegram icon name'
  );

  const appCssPath = path.resolve('src/app/App.css');
  const appCssContent = fs.readFileSync(appCssPath, 'utf8');

  assert.ok(
    appCssContent.includes('.netflix-footer__telegram-group'),
    'App.css must style netflix-footer__telegram-group'
  );
  assert.ok(
    appCssContent.includes('.netflix-footer__link--highlight'),
    'App.css must style highlighted Contact Me link'
  );
  assert.ok(
    appCssContent.includes('.netflix-footer__shop-btn'),
    'App.css must style netflix-footer__shop-btn with luxury glow'
  );
  assert.ok(
    appCssContent.includes('0, 230, 118'),
    'App.css footer shop button and highlight link must use green and white palette'
  );
});

test('22. Mobile navbar layout: profile avatar is preserved without cutoff across small screens', () => {
  const navCssPath = path.resolve('src/components/navigation/NavigationShell.css');
  const navCssContent = fs.readFileSync(navCssPath, 'utf8');

  // Verify mobile media query rules
  const mobileNavBlock = navCssContent.slice(
    navCssContent.indexOf('@media (max-width: 47.999rem)')
  );

  assert.ok(
    mobileNavBlock.includes('.top-navigation__vip-suffix') && mobileNavBlock.includes('display: none;'),
    'Mobile navbar must hide VIP suffix on mobile screens to save width'
  );
  assert.ok(
    mobileNavBlock.includes('.profile-button') && mobileNavBlock.includes('flex-shrink: 0;'),
    'Profile button must have flex-shrink: 0 on mobile to prevent clipping'
  );
  assert.ok(
    mobileNavBlock.includes('.profile-button__avatar') && mobileNavBlock.includes('flex-shrink: 0;'),
    'Profile avatar must have flex-shrink: 0 on mobile'
  );

  const brandCssPath = path.resolve('src/components/brand/BrandMark.css');
  const brandCssContent = fs.readFileSync(brandCssPath, 'utf8');
  assert.ok(
    brandCssContent.includes('clamp(4.4rem'),
    'BrandMark wordmark must compact on mobile screens to keep layout within bounds'
  );
});

test('23. Minimal footer shop button: sleek, compact design matching Netflix aesthetic', () => {
  const appCssPath = path.resolve('src/app/App.css');
  const appCssContent = fs.readFileSync(appCssPath, 'utf8');

  const shopBtnMatch = appCssContent.match(/\.netflix-footer__shop-btn\s*\{([^}]+)\}/);
  assert.ok(shopBtnMatch, 'netflix-footer__shop-btn must be defined in App.css');
  const rules = shopBtnMatch[1];

  assert.ok(rules.includes('padding: 0.32rem 0.65rem;'), 'Shop button must use minimal compact padding');
  assert.ok(rules.includes('font-size: 0.74rem;'), 'Shop button must use understated font-size');
  assert.ok(rules.includes('border-radius: 3px;'), 'Shop button must use sleek border-radius');

  const hoverMatch = appCssContent.match(/\.netflix-footer__shop-btn:hover\s*\{([^}]+)\}/);
  assert.ok(hoverMatch, 'netflix-footer__shop-btn:hover must be defined in App.css');
  assert.ok(hoverMatch[1].includes('transform: none;'), 'Shop button hover must avoid bulky movement');
});

test('24. Movie details mobile modal: presents as an authentic rounded bottom sheet, not a full-screen takeover', () => {
  const modalShellCss = fs.readFileSync(path.resolve('src/components/primitives/ModalShell.css'), 'utf8');
  const mobileModalBlock = modalShellCss.slice(
    modalShellCss.indexOf('@media (max-width: 48rem)')
  );

  assert.ok(
    !mobileModalBlock.includes('height: 100dvh;'),
    'Cinematic modal must not take 100dvh full-screen height on mobile'
  );
  assert.ok(
    mobileModalBlock.includes('border-radius: 20px 20px 0 0;'),
    'Cinematic modal panel must feature rounded top corners on mobile'
  );
  assert.ok(
    mobileModalBlock.includes('align-items: flex-end;'),
    'Cinematic modal must align to the bottom as an authentic sheet'
  );

  const detailsModalCss = fs.readFileSync(path.resolve('src/features/details-modal/components/DetailsModal.css'), 'utf8');
  const mobileDetailsBlock = detailsModalCss.slice(
    detailsModalCss.indexOf('@media (max-width: 48rem)')
  );

  assert.ok(
    mobileDetailsBlock.includes('border-radius: 20px 20px 0 0;'),
    'Details modal content and hero must inherit rounded top corners on mobile'
  );
  assert.ok(
    mobileDetailsBlock.includes('.details-modal::before'),
    'Details modal must render a sheet drag pull pill on mobile'
  );
});











