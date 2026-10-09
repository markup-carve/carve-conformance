import {readFileSync} from 'node:fs'
import {pathToFileURL} from 'node:url'
import {jsModule} from './environment.mjs'
const parser=process.argv[2]==='released' ? await import('@djot/djot') : (await import(pathToFileURL(jsModule))).default
process.stdout.write(parser.renderHTML(parser.parse(readFileSync(0,'utf8'))))
