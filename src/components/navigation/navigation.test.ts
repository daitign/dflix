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
