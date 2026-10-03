'use client';

// Share sheet (SPEC §10.1 /share/new): pick scope + items, toggle light/dark, live SVG
// preview rendered client-side by the pure card renderer, edit suggested text, then
// save the share (server re-derives items for privacy) and open the X intent URL.
import { useMemo, useState } from 'react';
import { renderShareCardSvg } from '../share/cards';
import { xIntentUrl, suggestedPostText, postLengthWithUrl } from '../share/intent';
import { buildShareCardModel, type ShareItem } from '../share/model';
import type { ShareScope } from '../share/scopes';

export interface ShareCandidate {
  item: ShareItem;
  /** Journal items need the extra consent checkbox. */
  isJournal?: boolean;
}

const SCOPES: { scope: ShareScope; label: string; hint: string }[] = [
  { scope: 'takeaway', label: 'Takeaway', hint: 'A single book line worth keeping.' },
  { scope: 'quest', label: 'Quest', hint: 'One finished quest.' },
  { scope: 'custom_set', label: 'Set', hint: 'Up to 6 items you choose.' },
  { scope: 'day', label: 'Day', hint: 'A full board.' },
  { scope: 'week', label: 'Week', hint: 'A week\'s scorecard.' },
  { scope: 'achievement', label: 'Honor', hint: 'One unlocked achievement.' },
  { scope: 'milestone', label: 'Milestone', hint: 'Statue moments.' },
];

export function ShareSheet({ candidatesByScope, handle, displayName, appUrl }: {
  candidatesByScope: Partial<Record<ShareScope, ShareCandidate[]>>;
  handle: string;
  displayName?: string;
  appUrl: string;
}) {
  const [scope, setScope] = useState<ShareScope>('takeaway');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [variant, setVariant] = useState<'light' | 'dark'>('light');
  const [includeJournal, setIncludeJournal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');

  const scopeCandidates = candidatesByScope[scope] ?? [];
  const anyJournal = scopeCandidates.some((c) => c.isJournal);
  const max = scope === 'custom_set' ? 6 : 1;

  const build = useMemo(() => buildShareCardModel({
    scope, handle, ...(displayName ? { displayName } : {}),
    items: scopeCandidates.map((c) => c.item),
    selectedIds: [...selected],
    includeJournal,
  }), [scope, scopeCandidates, selected, handle, displayName, includeJournal]);
  const model = build.ok ? build.model : null;

  const svg = model ? renderShareCardSvg(model, { variant, idPrefix: `sheet-${scope}` }) : null;
  const defaultText = model ? suggestedPostText(model) : '';
  const postText = text || defaultText;
  const shareUrl = saved ? `${appUrl}/s/${saved}` : undefined;
  const tooLong = postLengthWithUrl(postText, shareUrl ?? `${appUrl}/s/placeholder0`) > 280;

  function toggle(id: string) {
    setSelected((prev) => {
      const nextSet = new Set(prev);
      if (nextSet.has(id)) nextSet.delete(id);
      else {
        nextSet.add(id);
        while (nextSet.size > max) nextSet.delete(nextSet.keys().next().value!);
      }
      return nextSet;
    });
    setSaved(null);
  }

  async function save() {
    if (!model) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/shares', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ scope, itemIds: [...selected], includeJournal, template: variant }),
      });
      const data = await res.json() as { slug?: string; error?: string };
      if (!res.ok || !data.slug) throw new Error(data.error ?? 'Could not save share');
      setSaved(data.slug);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function post() {
    if (!shareUrl) return;
    window.open(xIntentUrl({ text: postText, url: shareUrl }), '_blank', 'noopener');
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
      <div className="space-y-5">
        <div className="card p-4">
          <p className="label">What to share</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {SCOPES.map((s) => (
              <button key={s.scope} type="button"
                onClick={() => { setScope(s.scope); setSelected(new Set()); setSaved(null); setText(''); }}
                className={`rounded-md border px-3 py-2 text-left text-sm ${scope === s.scope ? 'border-gold bg-gold/10 text-marble' : 'border-line text-shadow'}`}>
                <span className="font-display">{s.label}</span>
                <span className="block text-xs opacity-70">{s.hint}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="card p-4">
          <p className="label">Items {max > 1 ? `(up to ${max})` : '(pick one)'}</p>
          {scopeCandidates.length === 0 && <p className="mt-2 text-sm text-shadow">Nothing eligible under this scope yet.</p>}
          <div className="mt-2 max-h-64 space-y-1 overflow-y-auto">
            {scopeCandidates.map((c) => (
              <label key={c.item.id} className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm text-marble hover:bg-line/40">
                <input type="checkbox" className="mt-1" checked={selected.has(c.item.id)} onChange={() => toggle(c.item.id)} />
                <span>{itemLabel(c.item)}</span>
              </label>
            ))}
          </div>
          {anyJournal && (
            <label className="mt-3 flex items-start gap-2 border-t border-line pt-3 text-sm text-[#e8c35c]">
              <input type="checkbox" className="mt-1" checked={includeJournal} onChange={(e) => setIncludeJournal(e.target.checked)} />
              Include journal text on this card. It stays private otherwise.
            </label>
          )}
        </div>

        <div className="card p-4">
          <p className="label">Card style</p>
          <div className="mt-2 flex gap-2">
            {(['light', 'dark'] as const).map((v) => (
              <button key={v} type="button" onClick={() => setVariant(v)}
                className={`btn ${variant === v ? 'btn-primary' : ''}`}>{v === 'light' ? 'Marble' : 'Shadow'}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="overflow-hidden rounded-lg border border-line bg-black/30">
          {svg
            ? <div dangerouslySetInnerHTML={{ __html: svg }} />
            : <p className="p-10 text-center text-shadow">
              {build.ok === false ? build.reason : 'Pick an item to preview the card.'}
            </p>}
        </div>
        <div>
          <label className="label" htmlFor="posttext">Post text</label>
          <textarea id="posttext" className="input min-h-20" value={postText}
            onChange={(e) => { setText(e.target.value); setSaved(null); }} />
          <p className={`mt-1 text-right text-xs ${tooLong ? 'text-[#e88]' : 'text-shadow'}`}>
            {postLengthWithUrl(postText, shareUrl ?? `${appUrl}/s/placeholder0`)} / 280
          </p>
        </div>
        {error && <p className="text-sm text-[#e88]">{error}</p>}
        <div className="flex gap-3">
          <button type="button" className="btn" disabled={!model || busy} onClick={save}>
            {busy ? 'Saving…' : saved ? 'Saved ✓' : 'Save share'}
          </button>
          <button type="button" className="btn btn-primary" disabled={!saved || tooLong} onClick={post}>
            Post to X
          </button>
        </div>
        {saved && <p className="text-xs text-shadow">Live at <a className="text-gold underline" href={`/s/${saved}`} target="_blank" rel="noopener">{shareUrl}</a></p>}
      </div>
    </div>
  );
}

function itemLabel(item: ShareItem): string {
  switch (item.type) {
    case 'takeaway': return `“${item.text}”${item.bookTitle ? ` — ${item.bookTitle}` : ''}`;
    case 'quest': return `${item.title} (+${item.xp} XP)`;
    case 'pillar': return `${item.pillar} ${item.done}/${item.due}`;
    case 'stat': return `${item.label}: ${item.value}`;
    case 'journal': return 'Journal entry';
    case 'day': return `${item.date} — ${item.quests.filter((q) => q.title).length} quests`;
    case 'week': return `Week of ${item.weekStart}`;
    case 'achievement': return item.name;
    case 'milestone': return item.kind.replace(/_/g, ' ');
  }
}
