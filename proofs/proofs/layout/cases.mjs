// Traces are authored interpretations of Part 0 with the list rules in §24 C3. The runner's source check
// keeps an edited corpus example from silently retaining an obsolete trace.
const traces = [
  {
    name: 'post-blank-at-content',
    corpus: '143-post-blank-list-continuation-content-column-model-2',
    source: '- one\n\n  > q\n', target: 'q',
    boundary: 'blank', column: 2, modelOwner: true, observedOwner: true,
  },
  {
    name: 'post-blank-past-content',
    corpus: '143-post-blank-list-continuation-content-column-model-3',
    source: '- one\n\n   # h\n', target: 'h',
    boundary: 'blank', column: 3, modelOwner: true, observedOwner: true,
  },
  {
    name: 'post-blank-between-base-and-content',
    corpus: '143-post-blank-list-continuation-content-column-model',
    source: '- one\n\n > q\n', target: '> q',
    boundary: 'blank', column: 1, modelOwner: false, observedOwner: false,
  },
  {
    name: 'comment-at-base', corpus: '506-comment-columns-and-surviving-list-items',
    source: '- intro\n%% c\ntail\n', target: 'tail',
    boundary: 'line_comment', column: 0, modelOwner: true, observedOwner: true,
  },
  {
    name: 'post-blank-at-base',
    source: '- intro\n\ntail\n', target: 'tail',
    boundary: 'blank', column: 0, modelOwner: false, observedOwner: false,
  },
  {
    name: 'comment-at-content',
    source: '- intro\n  %% c\n  tail\n', target: 'tail',
    boundary: 'line_comment', boundaryColumn: 2, column: 2, modelOwner: true, observedOwner: true,
  },
  {
    name: 'ordinary-claim-at-base', source: '- intro\ntail\n', target: 'tail',
    boundary: 'ordinary', column: 0, modelOwner: true, observedOwner: true,
  },
  {
    name: 'interrupter-rejects-claim', source: '- intro\n# h\n', target: 'h',
    boundary: 'ordinary', column: 0, interrupts: true, modelOwner: false, observedOwner: false,
  },
  {
    name: 'blank-after-comment-clears-retention', source: '- intro\n%% c\n\ntail\n', target: 'tail',
    boundary: 'blank', column: 0, modelOwner: false, observedOwner: false,
  },
  {
    name: 'unmatched-comment-fence-is-line-comment', source: '- intro\n%%%\ntail\n', target: 'tail',
    boundary: 'line_comment', column: 0, modelOwner: true, observedOwner: true,
  },
  {
    name: 'comment-does-not-retain-interrupter', source: '- intro\n%% c\n# h\n', target: 'h',
    boundary: 'line_comment', column: 0, interrupts: true, modelOwner: false, observedOwner: false,
  },
  {
    name: 'content-comment-does-not-retain-base-follower', corpus: '506-comment-columns-and-surviving-list-items-2', source: '- intro\n  %% c\ntail\n', target: 'tail',
    boundary: 'line_comment', boundaryColumn: 2, column: 0, modelOwner: false, observedOwner: false,
  },
  {
    name: 'matched-comment-fence-at-base', boundaryInside: false, boundaryLine: 1, source: '- intro\n%%%\nc\n%%%\ntail\n', target: 'tail',
    boundary: 'fenced_comment', column: 0, modelOwner: false, observedOwner: false,
  },
  {
    name: 'closed-item-cannot-reclaim-indented-follower', corpus: '506-comment-columns-and-surviving-list-items-3', boundaryInside: false, boundaryLine: 1,
    source: '- intro\n%%%\nc\n%%%\n  tail\n', target: 'tail',
    boundary: 'fenced_comment', column: 2, modelOwner: false, observedOwner: false,
  },
  {
    name: 'comment-before-sibling-marker', corpus: '506-comment-columns-and-surviving-list-items-4', sibling: true, itemCount: 2,
    source: '- intro\n%% c\n- next\n', target: 'next',
    boundary: 'line_comment', column: 0, modelOwner: false, observedOwner: false,
  },
  {
    name: 'consecutive-comments-end-at-content', corpus: '506-comment-columns-and-surviving-list-items-5', boundaryColumn: 2,
    source: '- intro\n%% a\n  %% b\ntail\n', target: 'tail',
    boundary: 'line_comment', column: 0, modelOwner: false, observedOwner: false,
  },
  {
    name: 'outside-comment-cannot-reopen-item', corpus: '506-comment-columns-and-surviving-list-items-6', boundaryInside: false,
    source: '- intro\n  %% a\n%% b\ntail\n', target: 'tail',
    boundary: 'line_comment', column: 0, modelOwner: false, observedOwner: false,
  },
]

// The candidate is the first top-level item with this marker geometry.
// The sibling control admits a second item; ownership still refers to the first.
export const cases = traces.map(trace => ({
  ...trace,
  frame: { kind: 'ListItem', base: 0, content: 2, open: true, paragraph: true },
}))
