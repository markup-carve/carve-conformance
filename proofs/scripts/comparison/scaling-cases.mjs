import { scalingCases as originalCases } from '../properties/scaling-cases.mjs'

export const scalingCases = {
  ...originalCases,
  'interior-whitespace': { sizes: [2048, 4096, 8192, 16384], make: n => 'a' + ' '.repeat(n) + 'b\n' },
  'literal-brackets': { sizes: [128, 256, 512, 1024], make: n => '[' + 'alpha beta\n\n'.repeat(n) },
  'inline-links': { sizes: [128, 256, 512, 1024], make: n => 'alpha [ref](/target)\n\n'.repeat(n) },
  'sparse-definitions': { sizes: [128, 256, 512, 1024], make: n => '[r]: /target\n\n' + 'alpha beta\n\n'.repeat(n) },
  'dense-definitions': { sizes: [32, 64, 128, 256], make: n => Array.from({ length: n }, (_, i) => `[r${i}]: /target${i}\n`).join('') + '\n' + '[ref][r0]\n\n'.repeat(n) },
  'long-unicode': { sizes: [1024, 2048, 4096, 8192], make: n => '😀 alpha '.repeat(n) + '\n' },
  'unicode-paragraphs': { sizes: [128, 256, 512, 1024], make: n => '😀 alpha\n\n'.repeat(n) },
}
