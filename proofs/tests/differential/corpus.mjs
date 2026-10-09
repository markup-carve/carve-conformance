const atoms = {
  plain:'alpha\n',ref:'[alpha][ref]\n',collapsed:'[alpha][]\n',image:'![alpha][ref]\n',
  heading:'# Alpha\n',headingRef:'# [alpha][ref]\n',headingAttr:'# Alpha {.small}\n',
  inlineAttr:'[alpha]{#same .small}\n',blockAttr:'{#same .small}\nalpha\n',
  duplicateAttrs:'{#same}\n# Alpha\n',emphasis:'_alpha *beta*_\n',
  unmatched:'_alpha *beta\n',code:'`alpha *beta\n',link:'[alpha](target)\n',
  brokenLink:'[alpha](tar]get\n',brokenAttr:'{#same\nalpha\n',
  table:'| alpha | beta |\n|---|---|\n| [x][ref] | y |\n',
  footnote:'alpha[^ref]\n',fence:'```\n[alpha][ref]\n```\n',
  headingDup:'# Alpha\n\n# Alpha\n',unicode:'# Café α\n',
}
const quote=s=>s.trimEnd().split('\n').map(l=>'> '+l).join('\n')+'\n'
const list=s=>s.trimEnd().split('\n').map((l,i)=>(i?'  ':'- ')+l).join('\n')+'\n'
const wrappers={bare:s=>s,quote,list,quoteList:s=>quote(list(s)),listQuote:s=>list(quote(s)),nestedList:s=>list(list(s)),div:s=>'::: box\n'+s+'::: \n',footnote:s=>'[^note]:\n'+s.split('\n').map(l=>'  '+l).join('\n')+'\n\n[^note]\n'}
const contexts={alone:['',''],definitionAfter:['','\n[ref]: /target\n[alpha]: /alpha\n'],definitionBefore:['[ref]: /first\n[alpha]: /alpha\n\n',''],duplicateDefinition:['[ref]: /first\n\n','\n[ref]: /second\n'],headingBefore:['# Alpha\n\n',''],headingAfter:['','\n# Alpha\n'],footnoteAfter:['','\n[^ref]: note\n'],attributesAfter:['','\n{#same}\n# Alpha\n']}
export function corpus() {
  const seen=new Set(),rows=[]
  const add=(id,source)=>{if(!seen.has(source)){seen.add(source);rows.push({id,source})}}
  for(const [atom,source] of Object.entries(atoms)) for(const [wrapper,wrap] of Object.entries(wrappers)) for(const [context,[before,after]] of Object.entries(contexts)) add(`${atom}/${wrapper}/${context}`,before+wrap(source)+after)
  const chunks=['# A\n','{#A}\n# B\n','> # A\n','- # A\n','[A][]\n','[x][A]\n','[A]: /explicit\n','[^n]: note\n','x[^n]\n','{#A}\ntext\n']
  for(let i=0;i<chunks.length;i++)for(let j=0;j<chunks.length;j++)for(let k=0;k<chunks.length;k++)add(`sequence/${i}/${j}/${k}`,chunks[i]+'\n'+chunks[j]+'\n'+chunks[k])
  return rows
}
export function expandedCorpus() {
 const rows=corpus(),seen=new Set(rows.map(r=>r.source))
 const inline=['x','_x_','*x*','[x][r]','![x][r]','[x][]','![x][]','[^n]','[x]{#id .c}','`x`','{=x=}','[x](a(b)c)','[x](a\\)b)','[x][a b]','[x][a\nb]','[x][R]','[x]{title="q & z"}','x\\\ny','{_x_}','[x](a]b)','[x][a\\]b]','{#id','{a="x','[x](a','[x][a','α café']
 const wrap=[s=>s+'\n',s=>'# '+s+'\n',s=>'> '+s+'\n',s=>'- '+s+'\n',s=>'| '+s+' | y |\n|---|---|\n',s=>'[^n]: '+s+'\n\nx[^n]\n']
 const tail=['','\n[r]: /one\n','\n[R]: /two\n','\n[x]: /x\n','\n[a b]: /space\n','\n[^n]: note\n','\n{#id}\n# x\n']
 for(const [i,s] of inline.entries())for(const [j,f]of wrap.entries())for(const [k,t]of tail.entries()){
  const source=f(s)+t;if(!seen.has(source)){seen.add(source);rows.push({id:`expanded/${i}/${j}/${k}`,source})}
 }
 let state=414
 const random=n=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state%n}
 const blocks=['# x\n','# x[^n]\n','# [x]{#id}\n','{#x}\n# y\n','[x][r]\n','![x][r]\n','[r]: /one\n','[r]: /two\n','[^n]: note\n','x[^n]\n','> # x\n','- # x\n','|x|y|\n|---|---|\n','{.c}\ntext\n','- a\n\n  - b\n','> - a\n>\n>   b\n','{#id\n> x\n']
 for(let i=0;i<750;i++){
  const source=Array.from({length:3+random(3)},()=>blocks[random(blocks.length)]).join('\n')
  if(!seen.has(source)){seen.add(source);rows.push({id:`seed414/${i}`,source})}
 }
 return rows
}
