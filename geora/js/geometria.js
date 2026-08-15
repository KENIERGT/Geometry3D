/* =====================================================================
   GeoRA — motor geométrico compartido
   Cada cuerpo se define como una RED PLANA 2D + un árbol de bisagras.
   Plegar la red arma el cuerpo; desplegarla produce el desarrollo plano.
   Usado por index.html (app del estudiante) y generador.html (docente).
   ===================================================================== */
const T = THREE;
const GR = Math.PI/180;
const N_LADOS = 40;              // segmentos para aproximar circunferencias
const clamp = (v,a,b)=>Math.min(b,Math.max(a,v));

/* ---------------------------------------------------------------
   1. RED PLANA -> ÁRBOL DE CARAS CON BISAGRAS
   Una cara = polígono 2D [[x,z],...] en el plano de la red.
   Una bisagra = {padre, hijo, a:[x,z], b:[x,z], pliegue:radianes}
   El signo del pliegue es siempre positivo: cada cara hija gira hacia
   el interior del cuerpo (propiedad de los poliedros convexos).
   --------------------------------------------------------------- */

function poligonoMesh(poly, color, borde=true){
  const shape = new T.Shape();
  shape.moveTo(poly[0][0], poly[0][1]);
  for(let i=1;i<poly.length;i++) shape.lineTo(poly[i][0], poly[i][1]);
  shape.closePath();
  const g = new T.ShapeGeometry(shape);
  g.rotateX(Math.PI/2);                       // plano XY -> plano XZ
  const m = new T.MeshLambertMaterial({color, side:T.DoubleSide, transparent:true, opacity:.93});
  const mesh = new T.Mesh(g,m);
  const grupo = new T.Group(); grupo.add(mesh);
  if(borde){
    const pts = poly.map(p=>new T.Vector3(p[0],0,p[1]));
    pts.push(pts[0].clone());
    const lg = new T.BufferGeometry().setFromPoints(pts);
    const line = new T.Line(lg, new T.LineBasicMaterial({color:0x0b1220}));
    line.position.y = 0.0015;
    grupo.add(line);
  }
  grupo.userData.mat = m;
  return grupo;
}

// Cambio de coordenadas al marco local de una bisagra.
// t = {tx,tz,ux,uz}: origen en (tx,tz), eje X local sobre (ux,uz) unitario,
// eje Z local sobre la normal exterior (-uz, ux).
function aplicar(t, p){
  const dx=p[0]-t.tx, dz=p[1]-t.tz;
  return [ dx*t.ux + dz*t.uz, -dx*t.uz + dz*t.ux ];
}

function centroide(poly){
  let x=0,z=0; for(const p of poly){x+=p[0];z+=p[1];}
  return [x/poly.length, z/poly.length];
}

/* versión con transformación como función (permite composición sencilla) */
function construirCaraT(red, id, fn, pivotes){
  const cara = red.caras[id];
  const polyLocal = cara.poly.map(fn);
  const g = poligonoMesh(polyLocal, cara.color, cara.borde!==false);
  g.userData.id = id;

  for(const h of red.bisagras.filter(b=>b.padre===id)){
    let a = fn(h.a), b = fn(h.b);
    const cHijo = fn(centroide(red.caras[h.hijo].poly));
    let ux=b[0]-a[0], uz=b[1]-a[1];
    let L=Math.hypot(ux,uz); ux/=L; uz/=L;
    if((cHijo[0]-a[0])*(-uz) + (cHijo[1]-a[1])*(ux) < 0){ const t=a; a=b; b=t; }
    ux=b[0]-a[0]; uz=b[1]-a[1];
    L=Math.hypot(ux,uz); ux/=L; uz/=L;
    const phi = Math.atan2(-uz, ux);

    const pivot = new T.Group();
    pivot.position.set(a[0], 0, a[1]);
    pivot.rotation.order = 'YXZ';   // primero orientar la bisagra (Y), luego plegar sobre ella (X)
    pivot.rotation.y = phi;
    pivot.userData.pliegue = h.pliegue;
    pivotes.push(pivot);

    const trH = {tx:a[0], tz:a[1], ux, uz};
    const fnHijo = p => aplicar(trH, fn(p));
    pivot.add(construirCaraT(red, h.hijo, fnHijo, pivotes));
    g.add(pivot);
  }
  return g;
}

function construirRed(red){
  const pivotes = [];
  const idn = p=>[p[0],p[1]];
  const raiz = construirCaraT(red, red.raiz, idn, pivotes);
  const grupo = new T.Group();
  grupo.add(raiz);
  // centrar sobre el origen usando el centroide de la cara base
  const c = centroide(red.caras[red.raiz].poly);
  raiz.position.set(-c[0], 0, -c[1]);
  grupo.userData.pivotes = pivotes;
  grupo.userData.etiquetas = [];
  return grupo;
}

/* ---------------------------------------------------------------
   2. DEFINICIÓN DE LOS CUERPOS  (medidas en cm)
   --------------------------------------------------------------- */
const COL = { base:0x2f7dd1, lat:0x4da3ff, lat2:0x6fb6ff, tapa:0xffb340 };

function poliRegular(n, r, cx=0, cz=0, giro=0){
  const p=[];
  for(let i=0;i<n;i++){ const a=giro + i*2*Math.PI/n; p.push([cx+r*Math.cos(a), cz+r*Math.sin(a)]); }
  return p;
}

/* ángulo de pliegue entre dos caras a partir del diedro del cuerpo armado */
function pliegueDiedro(A, P1, P0, P2){
  const e = new T.Vector3().subVectors(P1,A).normalize();
  const w1 = new T.Vector3().subVectors(P0,A); w1.addScaledVector(e, -w1.dot(e));
  const w2 = new T.Vector3().subVectors(P2,A); w2.addScaledVector(e, -w2.dot(e));
  const diedro = w1.angleTo(w2);
  return Math.PI - diedro;
}

const CUERPOS = {
  cubo:{
    nombre:'Cubo', dims:[{k:'a',et:'Arista a',min:2,max:14,val:7}],
    red:d=>redPrisma(d.a,d.a,d.a),
    calc:d=>{const a=d.a;return{
      al:{f:`A<sub>L</sub> = 4·a² = 4·${a}²`, v:4*a*a},
      at:{f:`A<sub>T</sub> = 6·a² = 6·${a}²`, v:6*a*a},
      vo:{f:`V = a³ = ${a}³`, v:a*a*a}, c:6,v:8,ar:12}},
    etiq:d=>[['a = '+d.a+' cm',[0,0,d.a/2],'base'],['a = '+d.a+' cm',[d.a/2,d.a/2,0],'alto']]
  },
  prisma:{
    nombre:'Prisma rectangular',
    dims:[{k:'a',et:'Largo a',min:2,max:14,val:9},{k:'b',et:'Ancho b',min:2,max:14,val:5},{k:'h',et:'Altura h',min:2,max:14,val:7}],
    red:d=>redPrisma(d.a,d.b,d.h),
    calc:d=>{const{a,b,h}=d;return{
      al:{f:`A<sub>L</sub> = 2(a+b)·h = 2(${a}+${b})·${h}`, v:2*(a+b)*h},
      at:{f:`A<sub>T</sub> = A<sub>L</sub> + 2·a·b = ${2*(a+b)*h} + 2·${a}·${b}`, v:2*(a+b)*h+2*a*b},
      vo:{f:`V = a·b·h = ${a}·${b}·${h}`, v:a*b*h}, c:6,v:8,ar:12}},
    etiq:d=>[['a = '+d.a+' cm',[0,0,d.b/2],'base'],['b = '+d.b+' cm',[d.a/2,0,0],'base'],['h = '+d.h+' cm',[d.a/2,d.h/2,d.b/2],'alto']]
  },
  piramide:{
    nombre:'Pirámide cuadrangular',
    dims:[{k:'a',et:'Lado a',min:2,max:14,val:8},{k:'h',et:'Altura h',min:2,max:16,val:9}],
    red:d=>redPiramide(d.a,d.h),
    calc:d=>{const{a,h}=d; const ap=Math.sqrt(h*h+(a/2)*(a/2));return{
      al:{f:`A<sub>L</sub> = (P·ap)/2 = (4·${a}·${ap.toFixed(2)})/2`, v:4*a*ap/2},
      at:{f:`A<sub>T</sub> = A<sub>L</sub> + a² = ${(4*a*ap/2).toFixed(1)} + ${a}²`, v:4*a*ap/2+a*a},
      vo:{f:`V = (a²·h)/3 = (${a}²·${h})/3`, v:a*a*h/3}, c:5,v:5,ar:8,
      extra:`apotema ap = √(h² + (a/2)²) = ${ap.toFixed(2)} cm`}},
    etiq:d=>[['a = '+d.a+' cm',[0,0,d.a/2],'base'],['h = '+d.h+' cm',[0,d.h/2,0],'alto']]
  },
  cilindro:{
    nombre:'Cilindro',
    dims:[{k:'r',et:'Radio r',min:1,max:8,val:4},{k:'h',et:'Altura h',min:2,max:16,val:9}],
    red:d=>redCilindro(d.r,d.h),
    calc:d=>{const{r,h}=d;return{
      al:{f:`A<sub>L</sub> = 2·π·r·h = 2π·${r}·${h}`, v:2*Math.PI*r*h},
      at:{f:`A<sub>T</sub> = 2πr·h + 2πr² = ${(2*Math.PI*r*h).toFixed(1)} + ${(2*Math.PI*r*r).toFixed(1)}`, v:2*Math.PI*r*h+2*Math.PI*r*r},
      vo:{f:`V = π·r²·h = π·${r}²·${h}`, v:Math.PI*r*r*h}, c:'3*',v:'0*',ar:'2*',
      extra:'* Superficie curva: no es poliedro, no cumple la fórmula de Euler.'}},
    etiq:d=>[['r = '+d.r+' cm',[d.r/2,0,0],'base'],['h = '+d.h+' cm',[d.r,d.h/2,0],'alto']]
  },
  cono:{
    nombre:'Cono',
    dims:[{k:'r',et:'Radio r',min:1,max:8,val:4},{k:'h',et:'Altura h',min:2,max:16,val:10}],
    red:d=>redCono(d.r,d.h),
    calc:d=>{const{r,h}=d; const g=Math.sqrt(r*r+h*h);return{
      al:{f:`A<sub>L</sub> = π·r·g = π·${r}·${g.toFixed(2)}`, v:Math.PI*r*g},
      at:{f:`A<sub>T</sub> = πrg + πr² = ${(Math.PI*r*g).toFixed(1)} + ${(Math.PI*r*r).toFixed(1)}`, v:Math.PI*r*g+Math.PI*r*r},
      vo:{f:`V = (π·r²·h)/3 = (π·${r}²·${h})/3`, v:Math.PI*r*r*h/3}, c:'2*',v:'1*',ar:'1*',
      extra:`generatriz g = √(r² + h²) = ${g.toFixed(2)} cm  ·  * superficie curva`}},
    etiq:d=>[['r = '+d.r+' cm',[d.r/2,0,0],'base'],['h = '+d.h+' cm',[0,d.h/2,0],'alto'],
             ['g',[d.r/2,d.h/2,0],'alto']]
  }
};

/* ---- redes planas ---- */
function redPrisma(a,b,h){
  const base = [[0,0],[a,0],[a,b],[0,b]];
  const caras = { base:{poly:base, color:COL.base} };
  const bisagras = [];
  const aristas = [[[0,0],[a,0],a],[[a,0],[a,b],b],[[a,b],[0,b],a],[[0,b],[0,0],b]];
  aristas.forEach((e,i)=>{
    const L=e[2];
    // la cara lateral se dibuja fuera del rectángulo, perpendicular a la arista
    const ax=e[0][0], az=e[0][1], bx=e[1][0], bz=e[1][1];
    let ux=(bx-ax)/L, uz=(bz-az)/L;
    let ox=-uz, oz=ux;                                   // normal
    const cb=[a/2,b/2];
    if(((ax+bx)/2-cb[0])*ox + ((az+bz)/2-cb[1])*oz < 0){ ox=-ox; oz=-oz; }
    const poly=[[ax,az],[bx,bz],[bx+ox*h,bz+oz*h],[ax+ox*h,az+oz*h]];
    caras['lat'+i]={poly, color: i%2? COL.lat2:COL.lat};
    bisagras.push({padre:'base', hijo:'lat'+i, a:e[0], b:e[1], pliegue:Math.PI/2});
    if(i===0){ // tapa colgando de la primera cara lateral
      const p1=[bx+ox*h,bz+oz*h], p0=[ax+ox*h,az+oz*h];
      caras.tapa={poly:[p0,p1,[p1[0]+ox*b,p1[1]+oz*b],[p0[0]+ox*b,p0[1]+oz*b]], color:COL.tapa};
      bisagras.push({padre:'lat0', hijo:'tapa', a:p0, b:p1, pliegue:Math.PI/2});
    }
  });
  return {caras, bisagras, raiz:'base'};
}

function redPiramide(a,h){
  const base=[[0,0],[a,0],[a,a],[0,a]];
  const ap=Math.sqrt(h*h+(a/2)*(a/2));      // apotema lateral (altura del triángulo)
  const caras={base:{poly:base,color:COL.base}}, bisagras=[];
  const arist=[[[0,0],[a,0]],[[a,0],[a,a]],[[a,a],[0,a]],[[0,a],[0,0]]];
  const cb=[a/2,a/2];
  arist.forEach((e,i)=>{
    const ax=e[0][0],az=e[0][1],bx=e[1][0],bz=e[1][1];
    const L=Math.hypot(bx-ax,bz-az); const ux=(bx-ax)/L, uz=(bz-az)/L;
    let ox=-uz,oz=ux;
    if(((ax+bx)/2-cb[0])*ox+((az+bz)/2-cb[1])*oz<0){ox=-ox;oz=-oz;}
    const mx=(ax+bx)/2, mz=(az+bz)/2;
    caras['lat'+i]={poly:[[ax,az],[bx,bz],[mx+ox*ap, mz+oz*ap]], color:i%2?COL.lat2:COL.lat};
    bisagras.push({padre:'base',hijo:'lat'+i,a:e[0],b:e[1],pliegue:Math.PI-Math.atan2(h,a/2)});
  });
  return {caras,bisagras,raiz:'base'};
}

function redCilindro(r,h){
  const n=N_LADOS;
  const base=poliRegular(n,r);
  const s=2*r*Math.sin(Math.PI/n);           // lado del polígono
  const caras={base:{poly:base,color:COL.base}}, bisagras=[];
  // la banda lateral se despliega hacia -z a partir de la arista 0
  const A=base[0], B=base[1];
  const ux=(B[0]-A[0])/s, uz=(B[1]-A[1])/s;
  let ox=-uz, oz=ux;
  const cb=[0,0];
  if(((A[0]+B[0])/2-cb[0])*ox+((A[1]+B[1])/2-cb[1])*oz<0){ox=-ox;oz=-oz;}
  for(let i=0;i<n;i++){
    const p0=[A[0]+ux*s*i, A[1]+uz*s*i];
    const p1=[A[0]+ux*s*(i+1), A[1]+uz*s*(i+1)];
    const q1=[p1[0]+ox*h, p1[1]+oz*h], q0=[p0[0]+ox*h, p0[1]+oz*h];
    caras['lat'+i]={poly:[p0,p1,q1,q0], color:COL.lat, borde:false};
    if(i===0) bisagras.push({padre:'base',hijo:'lat0',a:A,b:B,pliegue:Math.PI/2});
    else bisagras.push({padre:'lat'+(i-1),hijo:'lat'+i,a:p0,b:q0,pliegue:2*Math.PI/n});
  }
  // tapa: polígono regular colgando del borde superior de lat0
  const t0=[A[0]+ox*h, A[1]+oz*h], t1=[B[0]+ox*h, B[1]+oz*h];
  const ang0=Math.atan2(t1[1]-t0[1], t1[0]-t0[0]);
  const cxz=[ (t0[0]+t1[0])/2 + ox*(r*Math.cos(Math.PI/n)), (t0[1]+t1[1])/2 + oz*(r*Math.cos(Math.PI/n)) ];
  const giro=Math.atan2(t0[1]-cxz[1], t0[0]-cxz[0]);
  caras.tapa={poly:poliRegular(n,r,cxz[0],cxz[1],giro), color:COL.tapa};
  bisagras.push({padre:'lat0',hijo:'tapa',a:t0,b:t1,pliegue:Math.PI/2});
  return {caras,bisagras,raiz:'base'};
}

function redCono(r,h){
  const n=N_LADOS;
  const base=poliRegular(n,r);
  const s=2*r*Math.sin(Math.PI/n);
  const apo=r*Math.cos(Math.PI/n);
  const ha=Math.sqrt(h*h+apo*apo);                // altura del triángulo lateral
  const g=Math.sqrt(h*h+r*r);                     // generatriz
  const caras={base:{poly:base,color:COL.base}}, bisagras=[];
  const A=base[0], B=base[1];
  const ux=(B[0]-A[0])/s, uz=(B[1]-A[1])/s;
  let ox=-uz,oz=ux;
  if(((A[0]+B[0])/2)*ox+((A[1]+B[1])/2)*oz<0){ox=-ox;oz=-oz;}
  // vértice del sector (ápice desplegado)
  const mx=(A[0]+B[0])/2, mz=(A[1]+B[1])/2;
  const V=[mx+ox*ha, mz+oz*ha];
  const dAng=2*Math.asin(s/(2*g));                 // apertura de cada triángulo en el sector
  // pliegue entre triángulos laterales consecutivos (diedro del cuerpo armado)
  const P=(k)=>new T.Vector3(r*Math.cos(k*2*Math.PI/n), 0, r*Math.sin(k*2*Math.PI/n));
  const APEX=new T.Vector3(0,h,0);
  const plChain=pliegueDiedro(APEX,P(1),P(0),P(2));
  let a0=[...A], b0=[...B];
  for(let i=0;i<n;i++){
    caras['lat'+i]={poly:[a0,b0,V], color:COL.lat, borde:false};
    if(i===0) bisagras.push({padre:'base',hijo:'lat0',a:A,b:B,pliegue:Math.PI-Math.atan2(h,apo)});
    else bisagras.push({padre:'lat'+(i-1),hijo:'lat'+i,a:a0,b:V,pliegue:plChain});
    // el siguiente triángulo se obtiene girando alrededor de V
    const rot=(p,ang)=>{const dx=p[0]-V[0],dz=p[1]-V[1],c=Math.cos(ang),si=Math.sin(ang);
      return [V[0]+dx*c-dz*si, V[1]+dx*si+dz*c];};
    let sentido=dAng;
    // probamos el sentido que aleja del polígono base
    const test=rot(b0,dAng);
    if(Math.hypot(test[0],test[1])<Math.hypot(rot(b0,-dAng)[0],rot(b0,-dAng)[1])) sentido=-dAng;
    a0=b0.slice(); b0=rot(b0,sentido);
  }
  return {caras,bisagras,raiz:'base'};
}



/* ---- etiqueta flotante (sprite de canvas) ---- */
function etiqueta(texto, color='#ffb340'){
  const c=document.createElement('canvas'); const x=c.getContext('2d');
  const f=44; x.font=`600 ${f}px system-ui,sans-serif`;
  const w=x.measureText(texto).width+30;
  c.width=w; c.height=f+26;
  x.font=`600 ${f}px system-ui,sans-serif`;
  x.fillStyle='rgba(10,18,34,.85)';
  x.beginPath(); x.roundRect(0,0,c.width,c.height,16); x.fill();
  x.strokeStyle=color; x.lineWidth=3; x.stroke();
  x.fillStyle=color; x.textBaseline='middle'; x.fillText(texto,15,c.height/2+2);
  const tex=new T.CanvasTexture(c); tex.anisotropy=4;
  const sp=new T.Sprite(new T.SpriteMaterial({map:tex, transparent:true, depthTest:false}));
  sp.scale.set(c.width/c.height*0.16, 0.16, 1);
  sp.renderOrder=999;
  return sp;
}

