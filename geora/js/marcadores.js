/* =====================================================================
   GeoRA — marcadores personalizables
   ---------------------------------------------------------------------
   Cada tarjeta que crea el docente usa un GLIFO distinto (rejilla 4x4).
   El mismo glifo se usa para (a) imprimir el marcador y (b) generar el
   archivo de patrón .patt que el detector necesita, de modo que la app
   del estudiante reconstruye los patrones sola: no hay que distribuir
   archivos, solo la lista de figuras y medidas (que viaja en el QR).
   ===================================================================== */

/* 12 glifos con distancia de Hamming >= 6 entre sí y entre sus rotaciones,
   y asimetría rotacional propia >= 5, para que el detector no los confunda
   ni se equivoque de orientación. La celda superior izquierda es el ancla. */
const GLIFOS = ["1000011111110100","1110100011110100","1110010000000100","1100101111100010",
                "1000110100110010","1010000001010010","1100001000110110","1100000110010000",
                "1100111001010000","1010011010100010","1000110011000110","1010101110000100"];
const MAX_TARJETAS = GLIFOS.length;

/* rejilla 4x4 del glifo idx: cel(f,c) = 1 -> negro */
function glifoCeldas(idx){
  const g = GLIFOS[idx % GLIFOS.length];
  const m = [];
  for(let f=0; f<4; f++){ const fila=[]; for(let c=0;c<4;c++) fila.push(+g[f*4+c]); m.push(fila); }
  return m;
}

/* Dibuja el marcador completo: cuadro negro con borde del 25 % y el glifo
   ocupando el 50 % central (proporción que espera AR.js). */
function dibujarMarcador(ctx, S, idx){
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, S, S);
  const b = S * 0.25;                 // borde negro (25 % del lado)
  const L = S * 0.5;                  // zona interior (50 % del lado)
  ctx.fillStyle = '#fff'; ctx.fillRect(b, b, L, L);
  // el glifo ocupa 12 de las 16 muestras interiores: queda un margen blanco
  // que separa el dibujo del borde negro y mejora la detección
  const g0 = b + L*2/16, p = L*3/16;
  const cel = glifoCeldas(idx);
  ctx.fillStyle = '#000';
  for(let f=0; f<4; f++) for(let c=0; c<4; c++)
    if(cel[f][c]) ctx.fillRect(g0 + c*p, g0 + f*p, p+0.5, p+0.5);
}

function marcadorDataURL(idx, px=600){
  const cv = document.createElement('canvas'); cv.width = cv.height = px;
  dibujarMarcador(cv.getContext('2d'), px, idx);
  return cv.toDataURL('image/png');
}

/* --------- generación del archivo de patrón (formato ARToolKit) ---------
   4 rotaciones x 3 canales x 16 filas x 16 valores.
   La rotación k es el giro antihorario k veces de la muestra 16x16.      */
function muestra16(idx){
  const cel = glifoCeldas(idx), m = [];
  for(let f=0; f<16; f++){
    const fila = [];
    for(let c=0; c<16; c++){
      const dentro = f>=2 && f<=13 && c>=2 && c<=13;   // mismo margen que el dibujo
      fila.push(dentro && cel[Math.floor((f-2)/3)][Math.floor((c-2)/3)] ? 0 : 255);
    }
    m.push(fila);
  }
  return m;
}
function rot90(m){                       // antihorario, como numpy.rot90
  const n = m.length, o = [];
  for(let i=0;i<n;i++){ const fila=[]; for(let j=0;j<n;j++) fila.push(m[j][n-1-i]); o.push(fila); }
  return o;
}
function generarPatt(idx){
  let m = muestra16(idx), sal = [];
  for(let k=0; k<4; k++){
    for(let canal=0; canal<3; canal++)
      for(let f=0; f<16; f++)
        sal.push(m[f].map(v => String(v).padStart(4,' ')).join(''));
    sal.push('');
    m = rot90(m);
  }
  return sal.join('\n');
}
/* Los 12 patrones se generan una sola vez con genera-patrones.js y se sirven
   como archivos estáticos; el detector de ARToolKit los carga por XHR. */
function pattURL(idx){
  return 'data/patrones/p' + String(idx % GLIFOS.length).padStart(2,'0') + '.patt';
}

/* ---------------------------------------------------------------------
   Configuración del docente <-> texto para el QR / enlace
   Formato:  v1|Docente o grupo|cubo:7|prisma:9,5,7|cono:4,10
   --------------------------------------------------------------------- */
function codificarConfig(cfg){
  const partes = ['v1', (cfg.titulo||'').replace(/[|]/g,' ')];
  for(const t of cfg.tarjetas) partes.push(t.cuerpo + ':' + t.valores.join(','));
  return partes.join('|');
}
function decodificarConfig(txt){
  if(!txt) return null;
  const p = txt.split('|');
  if(p[0] !== 'v1') return null;
  const cfg = { titulo: p[1] || '', tarjetas: [] };
  for(let i=2; i<p.length; i++){
    const [cuerpo, vals] = p[i].split(':');
    if(!CUERPOS[cuerpo]) continue;
    const valores = (vals||'').split(',').map(Number).filter(n=>!isNaN(n));
    if(valores.length !== CUERPOS[cuerpo].dims.length) continue;
    cfg.tarjetas.push({ cuerpo, valores });
  }
  return cfg.tarjetas.length ? cfg : null;
}
/* medidas -> objeto {a:.., h:..} que espera el motor geométrico */
function dimsDe(tarjeta){
  const def = CUERPOS[tarjeta.cuerpo], d = {};
  def.dims.forEach((x,i) => d[x.k] = tarjeta.valores[i]);
  return d;
}
function etiquetaTarjeta(t){
  const def = CUERPOS[t.cuerpo];
  return def.nombre + ' · ' + def.dims.map((x,i)=> x.k + ' = ' + t.valores[i] + ' cm').join(' · ');
}

/* Juego de tarjetas por defecto, para que la app funcione recién instalada */
const CONFIG_DEFECTO = {
  titulo: 'Juego de ejemplo',
  tarjetas: [
    { cuerpo:'cubo',      valores:[7] },
    { cuerpo:'prisma',    valores:[9,5,7] },
    { cuerpo:'piramide',  valores:[8,9] },
    { cuerpo:'cilindro',  valores:[4,9] },
    { cuerpo:'cono',      valores:[4,10] }
  ]
};
