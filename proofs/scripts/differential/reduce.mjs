export function reduce(source,evaluate,accept=()=>true) {
 let deletions=0,attempts=0
 while(true) {
  const chars=Array.from(source)
  const candidates=chars.map((_,i)=>chars.slice(0,i).concat(chars.slice(i+1)).join('')).filter(accept)
  const differs=evaluate(candidates);attempts+=candidates.length
  const index=differs.indexOf(true)
  if(index<0)return {source,deletions,attempts,minimality:'No single-character deletion preserving the selected input family retains a disagreement.'}
  source=candidates[index];deletions++
 }
}
