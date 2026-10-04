import test from 'node:test';
import assert from 'node:assert/strict';
import { TvFocusEngine } from './focus/TvFocusEngine.ts';
import { TvPreviewManager } from './previews/TvPreviewManager.ts';
import { TvPlayerStateMachine } from './player/TvPlayerStateMachine.ts';

test('TV V2 Performance Benchmark: D-pad navigation latency median & p95 across 500 steps', () => {
  const engine = new TvFocusEngine();

  // Build a typical Netflix TV grid: Nav rail + 10 rows with 20 items each = 205 focusable nodes
  engine.registerRow({ id: 'nav-rail', order: 0 });
  engine.registerNode({ id: 'nav-home', scope: 'root', rowId: 'nav-rail', order: 0 });
  engine.registerNode({ id: 'nav-shows', scope: 'root', rowId: 'nav-rail', order: 1 });
  engine.registerNode({ id: 'nav-movies', scope: 'root', rowId: 'nav-rail', order: 2 });
  engine.registerNode({ id: 'nav-search', scope: 'root', rowId: 'nav-rail', order: 3 });
  engine.registerNode({ id: 'nav-list', scope: 'root', rowId: 'nav-rail', order: 4 });

  for (let r = 0; r < 10; r++) {
    engine.registerRow({ id: `row-${r}`, order: r + 1 });
    for (let c = 0; c < 20; c++) {
      engine.registerNode({
        id: `card-${r}-${c}`,
        scope: 'root',
        rowId: `row-${r}`,
        order: c,
      });
    }
  }

  engine.setFocus('card-0-0');
  assert.equal(engine.getActiveNodeId(), 'card-0-0');

  // Measure 500 navigation steps
  const latenciesMs: number[] = [];
  const directions: Array<'down' | 'left' | 'right' | 'up'> = ['right', 'right', 'down', 'left', 'up', 'down', 'right'];

  for (let i = 0; i < 500; i++) {
    const dir = directions[i % directions.length];
    const start = performance.now();
    engine.navigate(dir);
    const end = performance.now();
    latenciesMs.push(end - start);
  }

  latenciesMs.sort((a, b) => a - b);
  const median = latenciesMs[Math.floor(latenciesMs.length / 2)];
  const p95 = latenciesMs[Math.floor(latenciesMs.length * 0.95)];
  const p99 = latenciesMs[Math.floor(latenciesMs.length * 0.99)];
  const max = latenciesMs[latenciesMs.length - 1];

  console.log(`[Benchmark] Navigation Latency across 500 steps: Median=${median.toFixed(4)}ms, p95=${p95.toFixed(4)}ms, p99=${p99.toFixed(4)}ms, Max=${max.toFixed(4)}ms`);

  // Verified latency constraints: key-to-focus must be well under 5ms, preferably <0.1ms since registration-based
  assert.ok(median < 1.0, `Median latency ${median.toFixed(4)}ms must be under 1ms`);
  assert.ok(p95 < 2.0, `p95 latency ${p95.toFixed(4)}ms must be under 2ms`);
  assert.ok(max < 10.0, `Max latency ${max.toFixed(4)}ms must be under 10ms`);
});

test('TV V2 Benchmark: Stress testing rapid D-pad scroll maintains Single Active Preview invariant', async () => {
  const manager = new TvPreviewManager();
  let activePreviewChanges = 0;

  manager.subscribe(() => {
    activePreviewChanges++;
  });

  // Rapidly navigate through 50 cards within 200ms (much faster than 500ms settling time)
  for (let i = 0; i < 50; i++) {
    manager.requestPreview(`movie-${i}`, { delayMs: 100 });
  }

  // During rapid scrolling, settling timer should NOT have fired for earlier items
  assert.equal(manager.getActivePreviewId(), null, 'Active preview must remain null during rapid movement');

  // Now settle on the final card
  manager.requestPreview('movie-final', { delayMs: 50 });

  // Wait for settle duration
  await new Promise((resolve) => setTimeout(resolve, 80));

  // Exactly the final card should be active
  assert.equal(manager.getActivePreviewId(), 'movie-final');

  manager.stopActive();
  assert.equal(manager.getActivePreviewId(), null);
});

test('TV V2 Benchmark: Long session stability (1000 player operations without lingering timers)', () => {
  const machine = new TvPlayerStateMachine();

  let stateTransitions = 0;
  const unsubscribe = machine.subscribe(() => {
    stateTransitions++;
  });

  for (let i = 0; i < 1000; i++) {
    machine.onUserInteraction(); // CONTROLS_VISIBLE
    machine.openSubtitles(); // SUBTITLE_SELECTOR_OPEN
    const back1 = machine.handleBack(); // Back to CONTROLS_VISIBLE
    assert.equal(back1, true);
    const back2 = machine.handleBack(); // Back to PLAYER_IDLE
    assert.equal(back2, true);
  }

  assert.equal(machine.getState(), 'PLAYER_IDLE');
  assert.equal(machine.isSubmenuOpen(), false);
  assert.ok(stateTransitions >= 4000, `Expected at least 4000 state transitions, got ${stateTransitions}`);

  unsubscribe();
  machine.destroy();
});
