const dialect = (carve, djot = carve, commonmark = djot) => ({ carve, djot, commonmark })
export const paragraphs = {
  prose: dialect('alpha beta gamma'), unicode: dialect('alpha café 日本語 omega'),
  strong: dialect('alpha *bold words* omega', undefined, 'alpha **bold words** omega'),
  emphasis: dialect('alpha /italic words/ omega', 'alpha _italic words_ omega'),
  link: dialect('alpha [label words](/target) omega'), reference: dialect('alpha [label words][ref] omega'),
  code: dialect('alpha `code words` omega'), unclosedCode: dialect('alpha `code words omega'),
  bullet: dialect('alpha - item words'), ordered: dialect('alpha 1. item words'),
  heading: dialect('alpha # heading words'), quote: dialect('alpha > quoted words'),
}
export const fragments = {
  paragraph: dialect('alpha\nbeta\n'), paragraphs: dialect('alpha\n\nbeta\n'),
  strong: dialect('*bold*\n', undefined, '**bold**\n'), emphasis: dialect('/italic/\n', '_italic_\n'),
  heading: dialect('# Heading\n\ntail\n'), code: dialect('```\na  b\n\nlast\n```\n'),
  quote: dialect('> alpha\n>\n> beta\n'), list: dialect('- alpha\n- beta\n'),
  ordered: dialect('1. alpha\n2. beta\n'), reference: dialect('[label][ref]\n\n[ref]: /target\n'),
}
const lines = (s, f) => s.replace(/\n$/, '').split('\n').map(f).join('\n') + '\n'
const quote = s => lines(s, l => l ? '> ' + l : '>')
const list = s => '- ' + lines(s, (l, i) => i ? (l ? '  ' + l : '') : l)
export const wrappers = {
  quote: { wrap: quote, path: ['quote'] }, list: { wrap: list, path: ['list'] },
  quoteList: { wrap: s => quote(list(s)), path: ['quote', 'list'] },
  listQuote: { wrap: s => list(quote(s)), path: ['list', 'quote'] },
}
export const references = { full: '[label][ref]\n', collapsed: '[ref][]\n', inline: '[label](/fixed)\n', code: '`[label][ref]`\n' }
export const prefixes = { paragraph: 'alpha\n\n', heading: '# Heading\n\n', code: '```\npayload\n```\n\n', quote: '> alpha\n\n', list: '- alpha\n\n', closedList: '- alpha\n\n# Boundary\n\n' }
export const suffixes = { paragraph: 'later\n', heading: '# Later\n', list: '- later\n', quote: '> later\n', code: '```\nlater\n```\n', definition: '[unrelated]: /target\n' }
export const probes = {
  comment: 'alpha %% hidden\n', caption: '> alpha\n\n^ caption\n', shortcut: '[ref]\n\n[ref]: /target\n',
  setext: 'heading\n======\n', unclosedCode: '`payload\n',
}
