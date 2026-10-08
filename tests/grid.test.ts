import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  fillGaps,
  type GridItem,
  gridRows,
  moveItem,
  placeItem,
  removeItem,
  resizeItem,
  settleGrid,
} from '../frontend/src/lib/grid.ts';

type Block = 'a' | 'b' | 'c' | 'd';
const item = (block: Block, x: number, y: number, w: number, h = 1): GridItem<Block> => ({ block, x, y, w, h });

// a over the top; b two rows tall beside c and d
const split = [item('a', 0, 0, 12), item('b', 0, 1, 7, 2), item('c', 7, 1, 5), item('d', 7, 2, 5)];

describe('snap grid', () => {
  test('settling removes overlaps and empty rows, in reading order', () => {
    assert.deepEqual(settleGrid([item('a', 0, 4, 12), item('b', 0, 2, 6), item('c', 6, 9, 6)]), [
      item('b', 0, 0, 6),
      item('c', 6, 0, 6),
      item('a', 0, 1, 12),
    ]);
  });

  test('a block moved down past its neighbours lets them rise', () => {
    assert.deepEqual(moveItem(split, 'a', 0, 3), [
      item('b', 0, 0, 7, 2),
      item('c', 7, 0, 5),
      item('d', 7, 1, 5),
      item('a', 0, 2, 12),
    ]);
  });

  test("a block moved onto another's row takes the place and pushes it down", () => {
    const stacked = [item('a', 0, 0, 12), item('b', 0, 1, 12), item('c', 0, 2, 12)];
    assert.deepEqual(moveItem(stacked, 'c', 0, 0), [item('c', 0, 0, 12), item('a', 0, 1, 12), item('b', 0, 2, 12)]);
    assert.deepEqual(moveItem(stacked, 'a', 0, 1), [item('b', 0, 0, 12), item('a', 0, 1, 12), item('c', 0, 2, 12)]);
  });

  test('a block moved sideways into a free column stays in its row', () => {
    assert.deepEqual(moveItem([item('a', 0, 0, 4), item('b', 0, 1, 12)], 'a', 8, 0), [
      item('a', 8, 0, 4),
      item('b', 0, 1, 12),
    ]);
  });

  test('moves and sizes are kept inside the grid', () => {
    assert.deepEqual(moveItem([item('a', 0, 0, 6)], 'a', 10, -2), [item('a', 6, 0, 6)]);
    assert.deepEqual(resizeItem([item('a', 8, 0, 4)], 'a', 8, 9), [item('a', 4, 0, 8, 4)]);
    assert.deepEqual(resizeItem([item('a', 0, 0, 4)], 'a', 1, 0), [item('a', 0, 0, 3, 1)]);
  });

  test('growing a block pushes what it now covers down', () => {
    assert.deepEqual(resizeItem([item('a', 0, 0, 6), item('b', 6, 0, 6)], 'a', 8, 1), [
      item('a', 0, 0, 8),
      item('b', 6, 1, 6),
    ]);
  });

  test('placing adds a block where it asks to be, or moves the one there; removing lets the rest rise', () => {
    assert.deepEqual(placeItem([item('a', 0, 0, 12)], item('b', 0, 0, 6)), [item('b', 0, 0, 6), item('a', 0, 1, 12)]);
    assert.deepEqual(placeItem([item('a', 0, 0, 12)], item('a', 3, 2, 6)), [item('a', 3, 0, 6)]);
    assert.deepEqual(removeItem(split, 'a'), [item('b', 0, 0, 7, 2), item('c', 7, 0, 5), item('d', 7, 1, 5)]);
    assert.equal(gridRows(split), 3);
    assert.equal(gridRows([]), 0);
  });

  test('gaps a missing block leaves are closed by the blocks beside it', () => {
    // without b, c and d take its columns
    assert.deepEqual(fillGaps(removeItem(split, 'b')), [item('a', 0, 0, 12), item('c', 0, 1, 12), item('d', 0, 2, 12)]);
    // a block only shares the columns no neighbour holds
    assert.deepEqual(fillGaps([item('a', 2, 0, 3), item('b', 7, 0, 3)]), [item('a', 0, 0, 7), item('b', 7, 0, 5)]);
  });
});
