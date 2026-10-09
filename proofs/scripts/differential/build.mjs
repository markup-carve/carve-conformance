import assert from 'node:assert/strict'
import {execFileSync,spawnSync} from 'node:child_process'
import {existsSync,mkdirSync,copyFileSync,cpSync,readFileSync,writeFileSync,readdirSync,rmSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {root,opamArgs,output,extractionEnvironment} from '../djot-v/environment.mjs'
const pin=JSON.parse(readFileSync(new URL('./pin.json',import.meta.url)))
const native=extractionEnvironment(),vendor=root+'.cache/djot-js-current',work=root+'.cache/djot-js-build'
const run=(bin,args,cwd=root)=>execFileSync(bin,args,{cwd,stdio:'inherit'})
mkdirSync(vendor,{recursive:true});mkdirSync(work,{recursive:true})
if(!existsSync(vendor+'/.git'))run('git',['-C',vendor,'init'])
assert.equal(output('git',['-C',vendor,'status','--porcelain','--untracked-files=no']),'','Pinned JS source has local changes')
const head=spawnSync('git',['-C',vendor,'rev-parse','--verify','HEAD'],{encoding:'utf8'}).stdout.trim()
if(head!==pin.commit){
 run('git',['-C',vendor,'fetch','--depth','1',pin.repository,pin.commit]);run('git',['-C',vendor,'checkout','--detach',pin.commit])
}
assert.equal(output('git',['-C',vendor,'rev-parse','HEAD']),pin.commit)
assert.equal(output('git',['-C',vendor,'status','--porcelain','--untracked-files=no']),'','Pinned JS source has local changes')
for(const file of ['package.json','package-lock.json','tsconfig.json'])copyFileSync(vendor+'/'+file,work+'/'+file)
for(const dir of ['src','lib','types'])rmSync(work+'/'+dir,{recursive:true,force:true})
cpSync(vendor+'/src',work+'/src',{recursive:true})
run('npm',['ci','--ignore-scripts','--no-audit','--no-fund'],work)
run(process.execPath,[work+'/node_modules/typescript/bin/tsc','--project',work+'/tsconfig.json'],work)
assert.equal(output('opam',[...opamArgs,'ocamlopt','-version']),native.ocaml)
const b=root+'.cache/djot-v/dist/_build/default'
copyFileSync(new URL('./html.ml',import.meta.url),root+'.cache/differential_html.ml')
run('opam',[...opamArgs,'ocamlopt','-I',b+'/kernel/.djot_kernel.objs/byte','-I',b+'/kernel/.djot_kernel.objs/native','-I',b+'/src/.djot.objs/byte','-I',b+'/src/.djot.objs/native',b+'/kernel/djot_kernel.cmxa',b+'/src/djot.cmxa',root+'.cache/differential_html.ml','-o',root+'.cache/differential-html'])
const hash=paths=>createHash('sha256').update(Buffer.concat(paths.map(p=>readFileSync(p)))).digest('hex')
const modules=readdirSync(work+'/lib').filter(p=>p.endsWith('.js')).sort()
writeFileSync(root+'.cache/differential-build.json',JSON.stringify({pin,native,typescript:JSON.parse(readFileSync(work+'/node_modules/typescript/package.json')).version,modules,jsSha256:hash(modules.map(p=>work+'/lib/'+p)),binarySha256:hash([root+'.cache/differential-html']),driverSha256:hash([root+'scripts/differential/html.ml'])},null,2)+'\n')
