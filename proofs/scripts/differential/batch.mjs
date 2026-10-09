import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
export function nativeBatch(binary,sources) {
 const chunks=sources.map(s=>{const b=Buffer.from(s);return Buffer.concat([Buffer.from(b.length+'\n'),b])})
 const output=execFileSync(binary,[],{input:Buffer.concat(chunks),timeout:60000,maxBuffer:32*1024*1024})
 let offset=0
 const result=sources.map(()=>{
  const end=output.indexOf(10,offset);assert.ok(end>=offset,'Missing frame length')
  const header=output.subarray(offset,end).toString();assert.match(header,/^\d+$/)
  const n=Number(header);assert.ok(Number.isSafeInteger(n)&&end+1+n<=output.length,'Truncated frame')
  offset=end+1+n;return output.subarray(end+1,offset).toString('utf8')
 })
 assert.equal(offset,output.length,'Unexpected output after final frame')
 return result
}
