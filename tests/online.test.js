import { describe, it, expect } from 'vitest';
import { makeRoomCode, normalizeCode, scoreRow, ROOM_RE, createApi, isConfigured } from '../src/core/online.js';

describe('online helpers', () => {
  it('makes valid 5-char room codes', () => {
    for (let i = 0; i < 50; i++) expect(makeRoomCode()).toMatch(ROOM_RE);
  });
  it('normalizes codes', () => expect(normalizeCode(' ab3dE ')).toBe('AB3DE'));
  it('builds a score row with score = wins*10+po', () => {
    const run = { wins: 60, losses: 22, po: 3, strength: 88.4, chem: 'Gut', lineup: [{ slot: 'PG', name: 'X', rating: 90, team: 'T' }] };
    const row = scoreRow(run, 'ABCDE', 'pid-12345678', 'Noah');
    expect(row).toMatchObject({ room: 'ABCDE', wins: 60, score: 603, strength: 88, name: 'Noah' });
    expect(row.lineup[0]).toEqual({ slot: 'PG', name: 'X', rating: 90 });
  });
  it('detects missing config', () => {
    expect(isConfigured({ url: '', anonKey: '' })).toBe(false);
    expect(isConfigured({ url: 'https://x.supabase.co', anonKey: 'k' })).toBe(true);
  });
  it('calls the REST api with auth headers', async () => {
    const calls = [];
    const api = createApi({ url: 'https://x.supabase.co/', anonKey: 'KEY' }, async (u, o) => { calls.push([u, o]); return { ok: true, status: 200, json: async () => [{ code: 'ABCDE', seed: 5 }] }; });
    expect((await api.getRoom('ABCDE')).seed).toBe(5);
    expect(calls[0][0]).toBe('https://x.supabase.co/rest/v1/rooms?code=eq.ABCDE&select=*');
    expect(calls[0][1].headers.apikey).toBe('KEY');
  });
});
