export const scalingCases = {
  'long-line': { sizes: [1024, 2048, 4096, 8192], make: n => 'word '.repeat(n) + 'end\n' },
  'unmatched-brackets': { sizes: [16, 32, 64, 128, 256, 1024], make: n => '['.repeat(n) + 'end\n' },
  'unmatched-closers': { sizes: [1024, 2048, 4096, 8192], make: n => ']'.repeat(n) + 'end\n' },
  'unclosed-code': { sizes: [1024, 2048, 4096, 8192], make: n => '`' + 'word '.repeat(n) + 'end\n' },
  'many-paragraphs': { sizes: [128, 256, 512, 1024], make: n => 'alpha beta\n\n'.repeat(n) },
  'nested-quotes': { sizes: [8, 16, 32, 64, 128, 192], make: n => '> '.repeat(n) + 'end\n' },
  'nested-lists': { sizes: [8, 16, 32, 64, 128, 192], make: n => '- '.repeat(n) + 'end\n' },
}
