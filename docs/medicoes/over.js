const crypto=require('crypto');const SECRET='h4-test-secret',KEY='h4-internal-key';
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt=p=>{const h=b64({alg:'HS256',typ:'JWT'}),b=b64({...p,iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600});return `${h}.${b}.${crypto.createHmac('sha256',SECRET).update(`${h}.${b}`).digest('base64url')}`};
const j=async(u,o)=>{const r=await fetch(u,o);const t=await r.text();let b;try{b=JSON.parse(t)}catch{b=t}return{s:r.status,b}};
(async()=>{
const admin=jwt({sub:crypto.randomUUID(),email:'a@t.l',role:'admin',donorId:null});
const unit=await j('http://127.0.0.1:3003/collection-units',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+admin},body:JSON.stringify({name:'Unidade Overbooking',address:'Rua X 1',city:'Ijui',uf:'RS',phone:'5599999999',simultaneousCapacity:5})});
const slot=new Date(Math.ceil((Date.now()+10*3600e3)/3600e3)*3600e3).toISOString();
const ds=[];for(let i=0;i<20;i++){const userId=crypto.randomUUID();const r=await j('http://127.0.0.1:3002/donors',{method:'POST',headers:{'content-type':'application/json','x-internal-api-key':KEY},body:JSON.stringify({userId,completeName:'Over Teste '+i,cpf:String(30000000000+i*131+Date.now()%100).slice(0,11),birthDate:'1990-01-01',sex:'F',phone:'55999990000',email:`ov${i}@t.local`,weightKg:65})});ds.push({userId,donorId:r.b.id,email:`ov${i}@t.local`})}
const res=await Promise.all(ds.map(d=>j('http://127.0.0.1:3003/appointments',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+jwt({sub:d.userId,email:d.email,role:'donor',donorId:d.donorId})},body:JSON.stringify({donorId:d.donorId,collectionUnitId:unit.b.id,dateTime:slot})})));
const c={};res.forEach(r=>c[r.s]=(c[r.s]||0)+1);console.log('capacidade 5, 20 simultaneos ->',JSON.stringify(c));
})();
