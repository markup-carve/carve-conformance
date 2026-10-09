export function finding(row) {
  if (row.groups.length === 1) return null
  const p = row.parameters
  if (row.family === 'fences') return 'footnote-fence-base'
  if (p.boundary === 'content-comment' && p.indent === 4) return p.host === 'list-list' ? 'nested-content-comment-opener' : 'opener-after-content-comment'
  if (p.boundary === 'low-comment' && p.indent === 1 && p.follower === 'sibling') return 'marker-below-content'
  if (p.host === 'list-quote' && p.boundary === 'ordinary') return 'quote-lazy-interruption'
  if (p.host === 'list-quote' && p.boundary === 'low-comment') return 'quote-comment-opener'
  if (p.host === 'list-list' && p.indent === 1 && p.follower === 'fence' && p.boundary !== 'content-comment') return 'nested-lazy-code'
  if (p.host === 'list-list' && p.boundary === 'low-comment') return p.indent === 2 ? 'nested-comment-outer-opener' : 'nested-comment-inner-opener'
  if (p.host === 'list-list' && p.boundary === 'content-comment' && p.follower === 'sibling') return 'nested-comment-marker'
  if (p.host === 'list-list' && p.boundary === 'content-comment') return 'nested-comment-retention'
  if (p.host === 'list-list' && p.boundary === 'comment-blank') return 'nested-comment-blank'
  throw new Error(`Unclassified disagreement: ${row.family}/${row.id}`)
}

// Resolved cases stay in the matrix; only disagreements need reduction.
export const representatives = {}
