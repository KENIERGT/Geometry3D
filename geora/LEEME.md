# GeoRA — Geometría espacial en Realidad Aumentada

Prototipo funcional para el proyecto *Aplicación de realidad aumentada para el aprendizaje
de cuerpos geométricos y desarrollos planos* (Matemática Educativa y Computación, UNAN-León).

Son **dos aplicaciones** que trabajan juntas:

| Archivo | Para quién | Qué hace |
|---|---|---|
| `generador.html` | docente | define figuras y medidas, imprime los marcadores y genera el QR |
| `index.html` | estudiante | se abre como cámara, escanea el marcador y muestra la figura |

## 1. El docente prepara el material

Abre `generador.html`:

1. Escribe el nombre del juego (por ejemplo *8.º grado A*).
2. Pega la dirección donde está publicada la app (el `index.html` de GitHub Pages).
3. Agrega las figuras que quiera —hasta 12— y **escribe las medidas que necesite**.
   El panel muestra al instante el área total y el volumen de cada una.
4. Pulsa **Imprimir marcadores**: sale una portada con el QR y las instrucciones, y después
   una página por figura con su marcador y sus medidas impresas debajo.
   La casilla *imprimir también los resultados* sirve para la copia del docente.

Imprimir **al 100 %**, sin “ajustar a la página”, en papel blanco mate. El cuadro negro debe
quedar de unos 11 cm de lado.

## 2. El estudiante usa la app

Escanea el QR de la portada con la cámara normal del celular. Se abre Chrome, acepta el permiso
de cámara y la app queda lista: **la configuración del docente se guarda en el teléfono**, así que
las siguientes veces funciona aunque no haya internet ni datos.

La pantalla es solo cámara, con el mensaje *Escanea la figura geométrica*. Al enfocar un marcador:

- La figura aparece sobre el papel con sus medidas reales.
- Abajo se muestran área lateral, área total y volumen, con la fórmula sustituida.
- El control **Desarrollo** despliega la figura en su red plana y la vuelve a armar.
- El botón **Activar fondo / Quitar fondo** cambia entre un fondo limpio de estudio
  (para observar mejor la figura) y la cámara real, donde la figura se ve como se comportaría
  sobre la mesa.

Si el dispositivo no tiene cámara —una computadora, por ejemplo— la app pasa sola a un modo
sin cámara con un botón para recorrer las figuras.

## 3. Publicar la app

La cámara solo funciona en `https://` o en `localhost`.

**Prueba local**

```bash
cd geora
python3 -m http.server 8000
```
Abrir `http://localhost:8000/generador.html`.

**Publicación para el aula (recomendado)**

1. Subir toda la carpeta a un repositorio de GitHub.
2. Settings → Pages → Source: `main`, carpeta raíz → Save.
3. Queda en `https://USUARIO.github.io/REPO/`. Esa es la dirección que se pega en el generador.

## Estructura

```
index.html               app del estudiante (cámara + RA)
generador.html           app del docente (marcadores personalizables + QR)
js/geometria.js          motor: redes planas, plegado, áreas y volúmenes
js/marcadores.js         glifos, generación de patrones y codificación del QR
genera-patrones.js       script de compilación: crea data/patrones/*.patt
data/patrones/p00..p11   los 12 patrones que reconoce el detector
data/camera_para.dat     parámetros de calibración de cámara
vendor/three.global.js   Three.js r164 compilado como global
vendor/ar-threex.js      AR.js 3.4.8 (seguimiento de marcadores)
vendor/qrcode.js         generador de códigos QR
sw.js, manifest.json     funcionamiento sin conexión (PWA)
```

## Cómo está construido (para el capítulo de metodología)

**El cuerpo y su desarrollo plano son el mismo objeto.** Cada figura se define como una red plana
(polígonos 2D) más un árbol de bisagras: qué cara se pliega sobre cuál, sobre qué arista y con qué
ángulo. El ángulo de cada bisagra es `π − ángulo diedro` del cuerpo armado. Un parámetro `t`
entre 0 y 1 interpola entre la red desplegada y el cuerpo armado, y de ahí sale la animación.

**Los marcadores no se distribuyen como archivos.** Hay 12 glifos fijos, elegidos por búsqueda
para que la distancia de Hamming entre ellos y entre sus rotaciones sea al menos 6 de 16 celdas,
y para que ninguno se parezca a sí mismo girado. El mismo glifo genera la imagen impresa y el
archivo de patrón que usa el detector, de modo que lo único que viaja en el QR es la lista de
figuras y medidas —un texto de pocos caracteres—. Por eso el docente puede cambiar las medidas
libremente sin regenerar nada del programa.

**Las superficies curvas** (cilindro y cono) se aproximan con 40 caras planas para poder
desplegarlas, pero el área y el volumen se calculan con las fórmulas exactas con π.

## Verificación hecha

- Los cinco cuerpos se arman y despliegan correctamente (comprobado midiendo la caja envolvente
  del modelo: el cubo de 7 cm mide exactamente 7 × 7 × 7).
- Los resultados numéricos coinciden con las fórmulas (cono de r = 4 y h = 10:
  A<sub>L</sub> = 135.34 cm², V = 167.55 cm³).
- Detección de marcadores probada con imágenes sintéticas de los 12 marcadores, con giros de
  −30° a 45° y los 12 patrones cargados a la vez: **9 de 9 aciertos**, confianza ≈ 0.998, y
  ningún falso positivo cuando el patrón correcto no estaba registrado.

## Límites conocidos

- Máximo 12 marcadores distintos por juego.
- El seguimiento por marcador es sensible a la iluminación; conviene probar en el aula real.
- No registra las respuestas del estudiante (sería la siguiente iteración).
- Requiere navegador con WebGL: conviene un censo previo de los teléfonos del grupo.

## Créditos

Three.js (MIT) · AR.js / ARToolKit (LGPL v3) · qrcode-generator (MIT).
