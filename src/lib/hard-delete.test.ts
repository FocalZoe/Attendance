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

beforeEach(() => {
  list.mockReset();
  remove.mockReset();
  rpc.mockReset();
  selectEq.mockReset();
});

describe('removeClassSnapshots', () => {
  it('removes files under the class folder and stops when the listing is empty', async () => {
    list.mockResolvedValueOnce({ data: [file('a.jpg'), file('b.jpg')], error: null });
    remove.mockResolvedValue({ error: null });

    const count = await removeClassSnapshots('c1');

    expect(count).toBe(2);
    expect(remove).toHaveBeenCalledWith(['c1/a.jpg', 'c1/b.jpg']);
    expect(list).toHaveBeenCalledTimes(1);
  });

  it('keeps listing until a page comes back short, removing in batches', async () => {
    const full = Array.from({ length: 100 }, (_, i) => file(`f${i}.jpg`));
    list
      .mockResolvedValueOnce({ data: full, error: null })
      .mockResolvedValueOnce({ data: [file('last.jpg')], error: null });
    remove.mockResolvedValue({ error: null });

    const count = await removeClassSnapshots('c1');

    expect(count).toBe(101);
    expect(remove).toHaveBeenCalledTimes(2);
  });

  it('throws a HardDeleteError when removal fails', async () => {
    list.mockResolvedValueOnce({ data: [file('a.jpg')], error: null });
    remove.mockResolvedValueOnce({ error: { message: 'nope' } });

    await expect(removeClassSnapshots('c1')).rejects.toBeInstanceOf(HardDeleteError);
  });
});

describe('deleteSchoolEverything', () => {
  it('does not touch the database when photo cleanup fails', async () => {
    selectEq.mockResolvedValue({ data: [{ id: 'c1' }], error: null });
    list.mockResolvedValue({ data: null, error: { message: 'storage down' } });

    await expect(deleteSchoolEverything('s1', { deleteAccounts: true })).rejects.toBeInstanceOf(HardDeleteError);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('cleans photos of every class, then calls the cascade RPC', async () => {
    selectEq.mockResolvedValue({ data: [{ id: 'c1' }, { id: 'c2' }], error: null });
    list.mockResolvedValue({ data: [], error: null });
    rpc.mockResolvedValue({ data: { classes: 2, students: 30, accounts: 4 }, error: null });

    const result = await deleteSchoolEverything('s1', { deleteAccounts: false });

    expect(list).toHaveBeenCalledTimes(2);
    expect(rpc).toHaveBeenCalledWith('delete_school_cascade', { p_school_id: 's1', p_delete_accounts: false });
    expect(result).toEqual({ classes: 2, students: 30, accounts: 4, snapshots: 0 });
  });
});

describe('deleteSessionRecord', () => {
  it('removes the photo and then deletes the row', async () => {
    remove.mockResolvedValue({ error: null });
    await deleteSessionRecord('sess1', 'c1/photo.jpg');
    expect(remove).toHaveBeenCalledWith(['c1/photo.jpg']);
  });

  it('skips storage when there is no photo', async () => {
    await deleteSessionRecord('sess1', null);
    expect(remove).not.toHaveBeenCalled();
  });

  it('keeps the row when the photo cannot be removed', async () => {
    remove.mockResolvedValue({ error: { message: 'denied' } });
    await expect(deleteSessionRecord('sess1', 'c1/photo.jpg')).rejects.toBeInstanceOf(HardDeleteError);
  });
});
