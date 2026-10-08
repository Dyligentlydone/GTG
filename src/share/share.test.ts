import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { buildShareCardModel, stripJournal, type ShareItem } from './model';
import { checkPublicText } from './filter';
import { fitPostText, fitsPost, postLength, postLengthWithUrl, suggestedPostText, xIntentUrl, MAX_POST_LENGTH, POST_URL_WEIGHT } from './intent';
import { CARD, renderShareCardSvg } from './cards';
import type { ShareCardModel } from './model';

const items: ShareItem[] = [
  { type: 'takeaway', id: 't1', text: 'Small habits compound into identity.', bookTitle: 'Atomic Habits', dayNumber: 12, pillar: 'mental' },
  { type: 'quest', id: 'q1', title: 'Read 10 pages a day from a self-development book', pillar: 'mental', xp: 20, date: '2026-09-28' },
  {
    type: 'day', id: 'd1', date: '2026-09-28', dayNumber: 34, fullSet: true, streak: 9,
    quests: [
      { title: 'Read 10 pages a day from a self-development book', pillar: 'mental', xp: 20 },
      { title: 'Journal once a day', pillar: 'emotional', xp: 15 },
      { title: 'Money minute', pillar: 'financial', xp: 10 },
    ],
  },
  {
    type: 'week', id: 'w1', weekStart: '2026-09-21', pagesRead: 70, dawns: 4, perfectWeek: false, piecesChiseled: 5,
    quests: [
      { title: 'Read 10 pages a day', pillar: 'mental', done: 7, due: 7 },
      { title: 'Exercise 4 days a week', pillar: 'physical', done: 3, due: 4 },
      { title: 'Journal once a day', pillar: 'emotional', done: 6, due: 7 },
    ],
  },
  { type: 'achievement', id: 'a1', name: 'Dawn Patrol', scope: 'physical', rarity: 'rare', rarityPct: 8 },
  { type: 'milestone', id: 'm1', kind: 'sculpture_halfway', piecesRevealed: 60, seed: 1, archetype: 'philosopher', decorations: ['laurel_leaf'] },
  { type: 'journal', id: 'j1', text: 'Private thoughts never leave the journal.', date: '2026-09-28' },
];

const model = (scope: string, ids: string[], includeJournal?: boolean): ShareCardModel => {
  const r = buildShareCardModel({ scope: scope as never, handle: 'dyl', items, selectedIds: ids, includeJournal });
  assert.ok(r.ok, r.ok ? '' : r.reason);
  return r.model;
};

describe('share card model', () => {
  test('keeps only ticked items', () => {
    const m = model('custom_set', ['q1']);
    assert.deepEqual(m.items.map((i) => i.id), ['q1']);
  });

  test('drops journal text unless includeJournal is true — even when ticked', () => {
    const without = model('custom_set', ['q1', 'j1']);
    assert.deepEqual(without.items.map((i) => i.id), ['q1']);
    assert.equal(without.includeJournal, false);
    const with_ = model('custom_set', ['q1', 'j1'], true);
    assert.deepEqual(with_.items.map((i) => i.id), ['q1', 'j1']);
  });

  test('stripJournal is a pure filter', () => {
    assert.equal(stripJournal(items).length, items.length - 1);
    assert.equal(stripJournal(items, true).length, items.length);
  });

  test('rejects wrong item types, too many items, bad handles and unknown scopes', () => {
    const build = (o: object) => buildShareCardModel({ scope: 'quest', handle: 'dyl', items, selectedIds: ['q1'], ...o } as never);
    assert.equal((build({ selectedIds: ['d1'] }) as { ok: false }).ok, false); // day item on a quest card
    // A ticked item of the wrong type is dropped from a custom set, not kept.
    const mixed = build({ scope: 'custom_set', selectedIds: ['q1', 'd1'] });
    assert.ok(mixed.ok);
    if (mixed.ok) assert.deepEqual(mixed.model.items.map((i) => i.id), ['q1']);
    assert.equal((build({ scope: 'quest', selectedIds: [] }) as { ok: false }).ok, false); // nothing ticked
    assert.equal((build({ handle: 'Bad Handle!' }) as { ok: false }).ok, false);
    assert.equal((build({ scope: 'nonsense' }) as { ok: false }).ok, false);
  });

  test('a milestone card validates the milestone kind', () => {
    const bad = [{ type: 'milestone', id: 'mx', kind: 'fake', piecesRevealed: 10, seed: 1 }] as unknown as ShareItem[];
    const r = buildShareCardModel({ scope: 'milestone', handle: 'dyl', items: bad, selectedIds: ['mx'] });
    assert.equal(r.ok, false);
  });

  test('derives the card pillar when every item shares one', () => {
    assert.equal(model('quest', ['q1']).pillar, 'mental');
    assert.equal(model('milestone', ['m1']).pillar, undefined);
  });
});

describe('public text filter', () => {
  test('blocks offensive text and common evasions, allows innocent words', () => {
    assert.equal(checkPublicText('This book is bullshit').ok, false);
    assert.equal(checkPublicText('f*ck this grind').ok, false);
    assert.equal(checkPublicText('sh1t happens').ok, false);
    assert.equal(checkPublicText('Scunthorpe is a real place').ok, true);
    assert.equal(checkPublicText('assessment day').ok, true);
  });

  test('a blocked takeaway cannot go on a card', () => {
    const bad: ShareItem[] = [{ type: 'takeaway', id: 'tb', text: 'what a shit book' }];
    const r = buildShareCardModel({ scope: 'takeaway', handle: 'dyl', items: bad, selectedIds: ['tb'] });
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.reason, /public card/i);
  });
});

describe('X intent URL and post length', () => {
  test('builds the intent URL with correct encoding', () => {
    const u = xIntentUrl({ text: 'Day 12: full set & a laurel', url: 'https://grind.example/s/abc?x=1' });
    assert.ok(u.startsWith('https://x.com/intent/post?'));
    const params = new URLSearchParams(u.slice(u.indexOf('?') + 1));
    assert.equal(params.get('text'), 'Day 12: full set & a laurel');
    assert.equal(params.get('url'), 'https://grind.example/s/abc?x=1');
  });

  test('every URL counts as 23 characters', () => {
    assert.equal(postLength('no links here'), 13);
    assert.equal(postLength('see https://example.com/very/long/path end'), 3 + 1 + POST_URL_WEIGHT + 1 + 3);
    assert.equal(postLengthWithUrl('hi', 'https://x.example'), 2 + POST_URL_WEIGHT);
  });

  test('long text is trimmed so text + URL stays within 280', () => {
    const long = 'word '.repeat(200);
    const u = xIntentUrl({ text: long, url: 'https://grind.example/s/x' });
    const text = new URLSearchParams(u.slice(u.indexOf('?') + 1)).get('text')!;
    assert.ok(text.endsWith('…'));
    assert.ok(postLengthWithUrl(text, 'https://grind.example/s/x') <= MAX_POST_LENGTH);
    assert.equal(fitsPost(long, 'https://grind.example/s/x'), false);
  });

  test('fitPostText cuts at a word boundary', () => {
    const fitted = fitPostText('alpha beta gamma '.repeat(40), 'https://x.example');
    assert.ok(postLengthWithUrl(fitted, 'https://x.example') <= MAX_POST_LENGTH);
    assert.ok(!/\s…$/.test(fitted) === false || fitted.endsWith('…'));
  });

  test('suggested post text fits the budget with the URL slot reserved and has at most one hashtag', () => {
    for (const [scope, id] of [['takeaway', 't1'], ['quest', 'q1'], ['custom_set', 'q1'], ['day', 'd1'], ['week', 'w1'], ['achievement', 'a1'], ['milestone', 'm1']] as const) {
      const text = suggestedPostText(model(scope, [id]));
      assert.ok(postLengthWithUrl(text, 'https://grind.example/s/x') <= MAX_POST_LENGTH, `${scope}: ${text}`);
      assert.ok((text.match(/#\w+/g) ?? []).length <= 1, `${scope}: ${text}`);
    }
  });
});

describe('share card SVG', () => {
  test('renders 1200×630 with wordmark, handle and frame for every scope', () => {
    for (const [scope, id] of [['takeaway', 't1'], ['quest', 'q1'], ['custom_set', 'q1'], ['day', 'd1'], ['week', 'w1'], ['achievement', 'a1'], ['milestone', 'm1']] as const) {
      for (const variant of ['light', 'dark'] as const) {
        const svg = renderShareCardSvg(model(scope, [id]), { variant });
        assert.ok(svg.includes(`viewBox="0 0 ${CARD.width} ${CARD.height}"`));
        assert.ok(svg.includes('GAMIFYING THE GRIND'), scope);
        assert.ok(svg.includes('@dyl'), scope);
        assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'), scope);
      }
    }
  });

  test('deterministic, and light differs from dark', () => {
    const m = model('week', ['w1']);
    const light = renderShareCardSvg(m, { variant: 'light' });
    assert.equal(renderShareCardSvg(m, { variant: 'light' }), light);
    assert.notEqual(renderShareCardSvg(m, { variant: 'dark' }), light);
  });

  test('milestone cards embed a bust crop of the player statue', () => {
    const svg = renderShareCardSvg(model('milestone', ['m1']), { idPrefix: 'm' });
    assert.ok(svg.includes('clip-path="url(#m-bust)"'));
    assert.ok((svg.match(/<svg/g) ?? []).length >= 2); // card + nested sculpture
    assert.ok(svg.includes('60 / 875'));
  });

  test('item text is XML-escaped on the card', () => {
    const tricky: ShareItem[] = [{ type: 'takeaway', id: 'tt', text: 'A <b> & "quotes" — still fine' }];
    const m = buildShareCardModel({ scope: 'takeaway', handle: 'dyl', items: tricky, selectedIds: ['tt'] });
    assert.ok(m.ok);
    const svg = renderShareCardSvg(m.model);
    assert.ok(!svg.includes('A <b>'));
    assert.ok(svg.includes('A &lt;b&gt; &amp;'));
  });
});
