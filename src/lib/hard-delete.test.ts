import { beforeEach, describe, expect, it, vi } from 'vitest';

const list = vi.fn();
const remove = vi.fn();
const rpc = vi.fn();
const selectEq = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    storage: { from: () => ({ list, remove }) },
    rpc: (...args: unknown[]) => rpc(...args),
    from: () => ({
      select: () => ({ eq: (...args: unknown[]) => selectEq(...args) }),
      delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
  },
}));

import { deleteSessionRecord, deleteSchoolEverything, removeClassSnapshots, HardDeleteError } from './hard-delete';

const file = (name: string) => ({ name, id: `id-${name}` });
const removed = (n: number) => ({ data: Array.from({ length: n }, (_, i) => ({ name: `f${i}` })), error: null });

beforeEach(() => {
  list.mockReset();
  remove.mockReset();
  rpc.mockReset();
  selectEq.mockReset();
});

describe('removeClassSnapshots', () => {
  it('removes files under the class folder and stops when the listing is empty', async () => {
    list.mockResolvedValueOnce({ data: [file('a.jpg'), file('b.jpg')], error: null });
    remove.mockResolvedValue(removed(2));

    const count = await removeClassSnapshots('c1');

    expect(count).toBe(2);
    expect(remove).toHaveBeenCalledWith(['c1/a.jpg', 'c1/b.jpg']);
    expect(list).toHaveBeenCalledTimes(1);
  });

  it('keeps listing until a page comes back short', async () => {
    const full = Array.from({ length: 100 }, (_, i) => file(`f${i}.jpg`));
    list
      .mockResolvedValueOnce({ data: full, error: null })
      .mockResolvedValueOnce({ data: [file('last.jpg')], error: null });
    remove.mockResolvedValueOnce(removed(100)).mockResolvedValueOnce(removed(1));

    expect(await removeClassSnapshots('c1')).toBe(101);
    expect(remove).toHaveBeenCalledTimes(2);
  });

  it('throws when storage reports an error', async () => {
    list.mockResolvedValueOnce({ data: [file('a.jpg')], error: null });
    remove.mockResolvedValueOnce({ data: null, error: { message: 'nope' } });

    await expect(removeClassSnapshots('c1')).rejects.toBeInstanceOf(HardDeleteError);
  });

  it('throws instead of looping when a policy silently removes nothing', async () => {
    const full = Array.from({ length: 100 }, (_, i) => file(`f${i}.jpg`));
    list.mockResolvedValue({ data: full, error: null });
    remove.mockResolvedValue({ data: [], error: null });

    await expect(removeClassSnapshots('c1')).rejects.toBeInstanceOf(HardDeleteError);
    expect(list).toHaveBeenCalledTimes(1);
  });
});

describe('deleteSchoolEverything', () => {
  it('keeps the photos when the database delete fails', async () => {
    selectEq.mockResolvedValue({ data: [{ id: 'c1' }], error: null });
    rpc.mockResolvedValue({ data: null, error: { message: 'function missing' } });

    await expect(deleteSchoolEverything('s1', { deleteAccounts: true })).rejects.toBeInstanceOf(HardDeleteError);
    expect(list).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it('deletes rows first, then cleans photos of every class', async () => {
    selectEq.mockResolvedValue({ data: [{ id: 'c1' }, { id: 'c2' }], error: null });
    list.mockResolvedValue({ data: [], error: null });
    rpc.mockResolvedValue({ data: { classes: 2, students: 30, accounts: 4 }, error: null });

    const result = await deleteSchoolEverything('s1', { deleteAccounts: false });

    expect(rpc).toHaveBeenCalledWith('delete_school_cascade', { p_school_id: 's1', p_delete_accounts: false });
    expect(list).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ classes: 2, students: 30, accounts: 4, snapshots: 0, photosFailed: false });
  });

  it('reports photosFailed instead of throwing when cleanup fails after the rows are gone', async () => {
    selectEq.mockResolvedValue({ data: [{ id: 'c1' }], error: null });
    rpc.mockResolvedValue({ data: { classes: 1, students: 3, accounts: 0 }, error: null });
    list.mockResolvedValue({ data: null, error: { message: 'storage down' } });

    const result = await deleteSchoolEverything('s1', { deleteAccounts: true });
    expect(result.photosFailed).toBe(true);
  });
});

describe('deleteSessionRecord', () => {
  it('deletes the row and then removes the photo', async () => {
    remove.mockResolvedValue(removed(1));
    const result = await deleteSessionRecord('sess1', 'c1/photo.jpg');
    expect(remove).toHaveBeenCalledWith(['c1/photo.jpg']);
    expect(result).toEqual({ removed: 1, failed: false });
  });

  it('skips storage when there is no photo', async () => {
    await deleteSessionRecord('sess1', null);
    expect(remove).not.toHaveBeenCalled();
  });

  it('flags a failed photo cleanup without throwing', async () => {
    remove.mockResolvedValue({ data: [], error: null });
    const result = await deleteSessionRecord('sess1', 'c1/photo.jpg');
    expect(result.failed).toBe(true);
  });
});
