const label = i => 'r' + String(i).padStart(6, '0')
const definitions = n => Array.from({ length: n }, (_, i) => `[${label(i)}]: /target\n`).join('\n')
export const performanceFixtures = {
  'nested-lists': { sizes: [128, 256, 512, 1024], make: n => '- '.repeat(n) + 'x\n' },
  'nested-quotes-control': { sizes: [128, 256, 512, 1024], make: n => '> '.repeat(n) + 'x\n' },
  'reference-definitions': { sizes: [256, 512, 1024, 2048], make: n => definitions(n) },
  'reference-definitions-and-uses': { sizes: [256, 512, 1024, 2048], make: n => definitions(n) + '\n' + Array.from({ length: n }, (_, i) => `[x][${label(i)}]`).join(' ') + '\n' },
}
