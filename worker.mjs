const encoder = new TextEncoder();
const cookieName = "__Host-tavola";
const sessionLife = 7 * 24 * 60 * 60;
const hex = bytes => Array.from(new Uint8Array(bytes), n => n.toString(16).padStart(2,"0")).join("");
const random = length => hex(crypto.getRandomValues(new Uint8Array(length)));
const digest = async text => hex(await crypto.subtle.digest("SHA-256",encoder.encode(text)));
const json = (body,status=200,headers={}) => Response.json(body,{status,headers:{"Cache-Control":"private, no-store",...headers}});
const cookie = (value,age) => cookieName+"="+value+"; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age="+age;

async function verifier(password,salt) {
  const key=await crypto.subtle.importKey("raw",encoder.encode(password),"PBKDF2",false,["deriveBits"]);
  return hex(await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",iterations:100000,salt:encoder.encode(salt)},key,256));
}

async function auth(request,db,path) {
  const now=Math.floor(Date.now()/1000);
  const token=(request.headers.get("Cookie") || "").split(/;\s*/).find(item=>item.startsWith(cookieName+"="))?.slice(cookieName.length+1);
  const tokenHash=token && /^[a-f0-9]{64}$/.test(token) ? await digest(token) : null;
  if(path==="/api/profile" && request.method==="GET") {
    const member=tokenHash && await db.prepare("SELECT a.name FROM tavola_accounts a JOIN tavola_sessions s ON s.account_id=a.id WHERE s.token_hash=? AND s.expires>?").bind(tokenHash,now).first();
    return member ? json({member}) : json({member:null},401);
  }
  if(!["/api/signup","/api/signin","/api/signout"].includes(path)) return json({error:"Page not found."},404);
  if(request.method!=="POST") return json({error:"POST required."},405);
  if(request.headers.get("Origin")!==new URL(request.url).origin) return json({error:"Invalid origin."},403);
  if(path==="/api/signout") {
    if(tokenHash) await db.prepare("DELETE FROM tavola_sessions WHERE token_hash=?").bind(tokenHash).run();
    return json({ok:true},200,{"Set-Cookie":cookie("",0)});
  }
  if(!request.headers.get("Content-Type")?.startsWith("application/json")) return json({error:"JSON required."},415);
  const data=await request.json().catch(()=>null);
  const email=typeof data?.email==="string"?data.email.trim().toLowerCase():"";
  const password=data?.password;
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||typeof password!=="string"||password.length>128||!password.length)
    return json({error:"Enter a valid email and password."},400);
  const bucket=await digest(path+":"+(request.headers.get("CF-Connecting-IP")||"shared"));
  const limit=await db.prepare("INSERT INTO tavola_attempts(bucket,count,expires) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=CASE WHEN expires<=? THEN 1 ELSE count+1 END, expires=CASE WHEN expires<=? THEN excluded.expires ELSE expires END RETURNING count").bind(bucket,now+300,now,now).first();
  if(limit.count>25) return json({error:"Too many attempts. Try again in five minutes."},429);
  let account;
  if(path==="/api/signup") {
    const name=typeof data.name==="string"?data.name.trim():"";
    if(!name||name.length>65||password.length<12) return json({error:"Enter your name and a password of at least 12 characters."},400);
    const salt=random(16), id=crypto.randomUUID();
    const result=await db.prepare("INSERT INTO tavola_accounts(id,email,name,salt,verifier) VALUES(?,?,?,?,?) ON CONFLICT(email) DO NOTHING").bind(id,email,name,salt,await verifier(password,salt)).run();
    if(!result.meta.changes) return json({error:"An account already uses that email. Try signing in."},409);
    account={id,name};
  } else {
    account=await db.prepare("SELECT id,name,salt,verifier FROM tavola_accounts WHERE email=?").bind(email).first();
    const computed=await verifier(password,account?.salt||"00000000000000000000000000000000");
    let difference=0;
    const expected=account?.verifier||"0".repeat(64);
    for(let i=0;i<64;i++) difference|=computed.charCodeAt(i)^expected.charCodeAt(i);
    if(!account||difference!==0) return json({error:"That email and password don’t match."},401);
  }
  const fresh=random(32);
  await db.batch([
    db.prepare("DELETE FROM tavola_sessions WHERE expires<=? OR token_hash=?").bind(now,tokenHash||""),
    db.prepare("DELETE FROM tavola_attempts WHERE expires<=?").bind(now),
    db.prepare("INSERT INTO tavola_sessions(token_hash,account_id,expires) VALUES(?,?,?)").bind(await digest(fresh),account.id,now+sessionLife)
  ]);
  return json({member:{name:account.name}},200,{"Set-Cookie":cookie(fresh,sessionLife)});
}

export async function handleRequest(request, env, assets) {
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/')) return auth(request, env.DB, url.pathname);
  if (!["GET","HEAD"].includes(request.method)) return new Response("Method not allowed",{status:405});
  const key = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
  if (!Object.hasOwn(assets,key)) return new Response("Page not found",{status:404});
  const {type,body,binary} = assets[key];
  const content = request.method === "HEAD" ? null : binary ? Uint8Array.from(atob(body),c=>c.charCodeAt(0)) : body;
  return new Response(content,{headers:{"Content-Type":type,"X-Content-Type-Options":"nosniff","Cache-Control":"private, no-cache"}});
}


