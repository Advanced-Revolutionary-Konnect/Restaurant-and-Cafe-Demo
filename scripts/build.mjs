import {readFileSync,writeFileSync,mkdirSync,readdirSync} from "node:fs";
import path from "node:path";
const types={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"text/javascript; charset=utf-8",".jpg":"image/jpeg"};
const assets={};
function collect(dir,prefix=""){
  for(const item of readdirSync(dir,{withFileTypes:true})){
    const file=path.join(dir,item.name),key=prefix+item.name;
    if(item.isDirectory()){collect(file,key+"/");continue;}
    const type=types[path.extname(item.name)];
    if(!type)throw Error("Unexpected site asset: "+key);
    const binary=type.startsWith("image/");
    assets[key]={body:readFileSync(file,binary?"base64":"utf8"),binary,type};
  }
}
collect("site");
mkdirSync("dist/server",{recursive:true});
const code=readFileSync("worker.mjs","utf8")+"\nconst assets="+JSON.stringify(assets)+";\nexport default {fetch(request,env){return handleRequest(request,env,assets);}};\n";
writeFileSync("dist/server/index.js",code);
console.log("Built "+Object.keys(assets).length+" site assets into the Worker.");

