import test from 'node:test';
import assert from 'node:assert/strict';
import { pickTask, chooseParallel, simulate, slotSeconds } from '../photoreal/lib/farm.mjs';

const machine = (name, ms, { remote = false, slotFactor = 1 } = {}) => ({ name, remote, slotFactor, msPerFrame: () => ms });
const task = (id, frames, extra = {}) => ({ id, frames, weight: frames, ...extra });

test('farm: a free slot takes the biggest scene it would finish no later than anyone else', () => {
  const fast = { machine: machine('pc', 500, { remote: true }), freeAt: 0 }, slow = { machine: machine('mac', 2000), freeAt: 0 };
  const pending = [task('a', 600), task('b', 60)];
  assert.equal(pickTask(fast, pending, [fast, slow], 0).id, 'a');
  // the Mac would take 1200 s for "a"; the PC, busy for another 100 s, would still finish it in 400
  fast.freeAt = 100;
  assert.equal(pickTask(slow, pending, [fast, slow], 0).id, 'b');
});

test('farm: lyric layers and scenes moved home stay on this Mac', () => {
  const pc = { machine: machine('pc', 100, { remote: true }), freeAt: 0 }, mac = { machine: machine('mac', 2000), freeAt: 0 };
  const layer = task('l', 60, { localOnly: true, light: true, est: 300 });
  assert.equal(pickTask(pc, [layer], [pc, mac], 0), null);
  assert.equal(pickTask(mac, [layer], [pc, mac], 0).id, 'l');
  assert.equal(slotSeconds(mac, layer), 18);
});

test('farm: add workers only while each adds at least 25%', () => {
  assert.deepEqual(chooseParallel([1, 1.74, 1.9]).parallel, 2);   // the Mac mini, measured tonight
  assert.deepEqual(chooseParallel([1, 1.1]).parallel, 1);
  const c = chooseParallel([2.2, 4.04, 5.36]);
  assert.equal(c.parallel, 3);
  assert.ok(Math.abs(c.speedup - 5.36 / 2.2) < 1e-9);
});

test('farm: two machines finish sooner than the faster one alone, and the estimate says so', () => {
  const tasks = Array.from({ length: 12 }, (_, i) => task(String(i), 400 + i * 50));
  const pc = { machine: machine('pc', 700, { remote: true }), freeAt: 0 };
  const macs = [1, 2].map(() => ({ machine: machine('mac', 2600, { slotFactor: 2 / 1.74 }), freeAt: 0 }));
  const alone = simulate(tasks, [pc]), both = simulate(tasks, [pc, ...macs]);
  assert.ok(both < alone, `${both} < ${alone}`);
  assert.ok(Number.isFinite(both));
  assert.equal(simulate([], [pc]), 0);
});
