import { cases as traces01 } from './cases.mjs'

// The spec text the readings cite (syntax-blocks.md) and the carve-js build they are compared with.
export const spec = { repository: 'markup-carve/carve', ref: 'next2', commit: '9a0ee0004fc0589d2d524785c7bd3fee485e30ed', file: 'spec/0.2/syntax-blocks.md' }
export const engine = { package: 'carve-next2', repository: 'markup-carve/carve-js', commit: '42644b716ea55e55842953a2733fcccfea3718b6' }

// The 0.1 traces read under 0.2. `target` is the follower's text in the 0.2 tree; `owner` is
// 'item', 'outside', or 'comment' when an open comment body takes the follower.
const readings = {
  'post-blank-at-content': { target: 'q', owner: 'item', clauses: ['C2-B-013', 'C2-B-025'] },
  'post-blank-past-content': { target: 'h', owner: 'item', clauses: ['C2-B-013', 'C2-B-025'] },
  'post-blank-between-base-and-content': { target: 'q', owner: 'item', clauses: ['C2-B-013', 'C2-B-025'] },
  'comment-at-base': { target: 'tail', owner: 'item', clauses: ['C2-B-137', 'C2-B-012'] },
  'post-blank-at-base': { target: 'tail', owner: 'outside', clauses: ['C2-B-013', 'C2-B-025', 'C2-B-026'] },
  'comment-at-content': { target: 'tail', owner: 'item', clauses: ['C2-B-137', 'C2-B-012'] },
  'ordinary-claim-at-base': { target: 'tail', owner: 'item', clauses: ['C2-B-012'] },
  'interrupter-rejects-claim': { target: '# h', owner: 'item', clauses: ['C2-B-024'] },
  'blank-after-comment-clears-retention': { target: 'tail', owner: 'outside', clauses: ['C2-B-137', 'C2-B-013', 'C2-B-025'] },
  'unmatched-comment-fence-is-line-comment': { target: 'tail', owner: 'comment', clauses: ['C2-B-014', 'C2-B-111'] },
  'comment-does-not-retain-interrupter': { target: '# h', owner: 'item', clauses: ['C2-B-137', 'C2-B-024'] },
  'content-comment-does-not-retain-base-follower': { target: 'tail', owner: 'item', clauses: ['C2-B-137', 'C2-B-012'] },
  'matched-comment-fence-at-base': { target: 'tail', owner: 'outside', clauses: ['C2-B-014', 'C2-B-228', 'C2-B-109', 'C2-B-025'] },
  'closed-item-cannot-reclaim-indented-follower': { target: 'tail', owner: 'outside', clauses: ['C2-B-014', 'C2-B-228', 'C2-B-026'] },
  'comment-before-sibling-marker': { target: 'next', owner: 'outside', clauses: ['C2-B-137', 'C2-B-015'] },
  'consecutive-comments-end-at-content': { target: 'tail', owner: 'item', clauses: ['C2-B-137', 'C2-B-012'] },
  'outside-comment-cannot-reopen-item': { target: 'tail', owner: 'item', clauses: ['C2-B-137', 'C2-B-012'] },
}

export const cases = traces01.map(({ name, source, observedOwner }) => {
  const reading = readings[name]
  if (!reading) throw new Error(`${name}: no 0.2 reading`)
  return { name, source, owner01: observedOwner ? 'item' : 'outside', ...reading }
})

export const readingNames = Object.keys(readings)
