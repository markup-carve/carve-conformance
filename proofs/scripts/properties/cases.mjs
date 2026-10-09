export const paragraphs = {
  plain: 'alpha beta gamma delta',
  unicode: 'alpha café 日本語 omega',
  emphasis: 'alpha *bold words* /italic words/ _underlined words_ omega',
  braced: 'alpha {*bold words*} {^high words^} {,low words,} omega',
  link: 'alpha [label words](https://example.test/a) omega',
  reference: 'alpha [label words][ref] omega',
  code: 'alpha `code words` omega',
  bullet: 'alpha - item words omega',
  star: 'alpha * item words omega',
  ordered: 'alpha 1. item words omega',
  plus: 'alpha + words omega',
  heading: 'alpha # heading words omega',
  quote: 'alpha > quoted words omega',
  attributes: 'alpha {.marked} words omega',
  comment: 'alpha %% hidden words omega',
  codeFence: 'alpha ``` code words omega',
  rawFence: 'alpha ```=html raw words omega',
  colonFence: 'alpha ::: note words omega',
  referenceDefinition: 'alpha [ref]: /target words omega',
  footnoteDefinition: 'alpha [^n]: note words omega',
  thematic: 'alpha --- omega',
}

export const fragments = {
  paragraph: 'alpha *bold*\nbeta\n',
  paragraphs: 'alpha\n\nbeta\n',
  heading: '# Heading\n\ntail\n',
  code: '```\na  b\n\nlast\n```\n',
  quote: '> alpha\n>\n> beta\n',
  list: '- alpha\n- beta\n',
  ordered: '1. alpha\n2. beta\n',
  comment: 'alpha\n%% hidden\nbeta\n',
  commentFence: 'alpha\n%%%\nhidden\n%%%\nbeta\n',
  attributes: '{.marked}\nalpha\n',
  div: '::: note\nalpha\n:::\n',
  table: '| a | b |\n|---|---|\n| c | d |\n',
  reference: '[label][ref]\n\n[ref]: /target\n',
}

const mapLines = (source, fn) => source.replace(/\n$/, '').split('\n').map(fn).join('\n') + '\n'
export const wrappers = {
  quote: { wrap: s => mapLines(s, l => l ? '> ' + l : '>'), path: ['quote'] },
  list: { wrap: s => '- ' + mapLines(s, (l, i) => i ? (l ? '  ' + l : '') : l), path: ['list'] },
  quoteList: { wrap: s => mapLines('- ' + mapLines(s, (l, i) => i ? (l ? '  ' + l : '') : l), l => l ? '> ' + l : '>'), path: ['quote', 'list'] },
  listQuote: { wrap: s => '- ' + mapLines(mapLines(s, l => l ? '> ' + l : '>'), (l, i) => i ? '  ' + l : l), path: ['list', 'quote'] },
}

export const references = {
  full: { source: '[label][ref]\n', definition: '[ref]: /target\n' },
  collapsed: { source: '[ref][]\n', definition: '[ref]: /target\n' },
  shortcut: { source: '[ref]\n', definition: '[ref]: /target\n' },
  image: { source: 'alpha ![label][ref] omega\n', definition: '[ref]: /image.png\n' },
  footnote: { source: 'alpha[^note] omega\n', definition: '[^note]: note content\n' },
  inlineLink: { source: '[label](/fixed)\n', definition: '[ref]: /target\n' },
  escaped: { source: '\\[label][ref]\n', definition: '[ref]: /target\n' },
  code: { source: '`[label][ref]`\n', definition: '[ref]: /target\n' },
}

export const completed = {
  paragraph: 'alpha *bold*\n\n',
  closedList: '- alpha\n\n# Boundary\n\n',
  closedQuote: '> alpha\n\n# Boundary\n\n',
  heading: '# Heading\n\n',
  code: '```\npayload\n```\n\n',
  quote: '> alpha\n\n',
  list: '- alpha\n\n',
  table: '| a | b |\n|---|---|\n| c | d |\n\n',
  comment: '%%%\nhidden\n%%%\n\n',
}
export const suffixes = {
  paragraph: 'later\n', heading: '# Later\n', list: '- later\n',
  quote: '> later\n', attributes: '{.later}\nnext\n', caption: '^ caption\n',
  code: '```\nlater\n```\n', definition: '[unrelated]: /target\n',
}

export const lookaheadControls = [
  { id: 'unclosed-code', before: 'alpha\n```\npayload\n', after: 'alpha\n```\npayload\n```\n' },
  { id: 'unclosed-comment', before: 'alpha\n%%%\npayload\n', after: 'alpha\n%%%\npayload\n%%%\n' },
]
