# Rebodocs

Editor de documentos Word (DOCX) para el navegador, con motor propio: el modelo
del documento, el corte de líneas, la paginación, el caret, la selección y la
lectura/escritura de DOCX están escritos aquí. No usa ProseMirror, ni
`contenteditable`, ni ninguna librería de edición. La única dependencia de
ejecución es `fflate`, para abrir y cerrar el ZIP.

```bash
npm install
npm run dev        # playground en http://localhost:5173
npm test           # tests del núcleo
npm run typecheck
npm run word-compare -- contrato.docx   # compara el layout con el de Word
```

## Estructura

```
packages/
  core/                 Núcleo. No toca el DOM: corre igual en navegador y en Node.
    src/
      model.ts          Tipos del documento y valores por defecto
      ops.ts            Operaciones de edición (insertar, borrar, partir, formato)
      numbering.ts      Listas: definiciones, contadores y texto de las etiquetas
      pageNumbers.ts    Número de página: ponerlo, moverlo o quitarlo del encabezado o el pie
      tables.ts         Forma de las tablas: crear una, añadir y quitar filas y columnas
      styles.ts         Estilos de párrafo: los que ofrece un documento y aplicarlos
      markdown.ts       Modelo -> Markdown
      find.ts           Buscar y reemplazar
      images.ts         Imágenes: insertar, redimensionar y mover
      pdf.ts            Layout -> PDF
      variables.ts      Plantillas: variables {{nombre}} y rellenarlas
      notes.ts          Notas sobre trozos del texto (comentarios de Word)
      toc.ts            Índice: tabla de contenido con páginas (campo TOC de Word)
      links.ts          Enlaces a una página, un correo o un teléfono
      stories.ts        Encabezados y pies por parte: los de todas las páginas y los de la primera
      letterhead.ts     Membrete: una imagen a página completa bajo el texto de todas las páginas
      autoformat.ts     Formato al escribir: "# ", "- ", **negrita**
      outline.ts        Esquema: títulos, secciones y moverlas
      fonts.ts          Medir texto con archivos de fuente, sin navegador
      png.ts            Leer PNG y JPEG sin navegador
      render.ts         Documento -> PDF solo con archivos de fuente
      layout.ts         Corte de líneas, paginación y geometría (caret, clic, selección)
      docx/
        xml.ts          Parser y serializador XML
        import.ts       DOCX -> modelo
        export.ts       Modelo -> DOCX
        source.ts       El paquete DOCX original que acompaña al documento
    test/               Tests de todo lo anterior
  editor/               Capa de navegador
    src/
      measurer.ts       Mide texto con un canvas
      editor.ts         Pinta páginas, caret y selección; teclado, ratón, portapapeles, deshacer
      toolbar.ts        Barra de herramientas: cada comando del editor como botón, lista o menú
      sidebar.ts        Menú del documento: archivo, exportar y configuración de la página
      ruler.ts          Regla: escala, márgenes y sangrías
      findbar.ts        Panel de buscar y reemplazar
      panel.ts          Panel lateral: esquema, variables y notas
      bubble.ts         Acciones junto a la selección, con un toque a ⌘
      imagegrid.ts      Elegir varias imágenes y ordenarlas en cuadrícula
      i18n.ts           Los textos de la interfaz, en español e inglés
      statusbar.ts      Barra de estado: página, contadores, vistas y zoom
  mcp/                  Servidor MCP: lo que conecta un asistente de IA con los documentos
    src/
      tools.ts          Las herramientas: leer, buscar, reemplazar, insertar, notas… Puras, sin Node ni DOM
      server.ts         El protocolo (JSON-RPC) y los archivos abiertos en memoria
      bridge.ts         El camino hasta un editor abierto en el navegador (HTTP en este equipo)
      browser.ts        El lado del editor: escucha al servidor y aplica las herramientas
      fonts.ts          Buscar archivos de fuente en el equipo
      main.ts           Arranca el servidor por entrada y salida estándar
  collab/               Varias personas en el mismo documento a la vez
    src/
      changes.ts        Los cambios que se envían: sacarlos, aplicarlos y reajustarlos. Puro, sin Node ni DOM
      server.ts         El servidor de sala: ordena los cambios de todos
      storage.ts        Dónde viven los documentos: en memoria, en una carpeta o en otro sistema
      session.ts        El lado del editor: envía lo propio, aplica lo ajeno, cursores y deshacer
      main.ts           Arranca el servidor
  react/                El editor entero como componente de React, para instalarlo en otro proyecto
    src/
      docs.ts           El editor sin interfaz: las páginas, un estado que leer y comandos que llamar. Sin React
      headless.ts       Lo mismo para React: DocsProvider, DocsSurface, useDocs
      pieces.ts         Buscar, enlace, notas, esquema, variables, estilos y página, como hooks sin aspecto
      mount.ts          La interfaz incluida, hecha sobre docs.ts: barra, regla, panel y barra de estado
      DocsEditor.ts     El componente con esa interfaz
apps/
  playground/           Página de pruebas: el editor con su menú, barra de herramientas, regla y barra de estado
tools/
  word-compare.mjs      Compara el layout del editor con el de Microsoft Word
  float-cases.ts        Documentos con imágenes flotantes para medirlas contra Word
  generate.ts           Rellena una plantilla desde la línea de comandos
```

La regla que ordena todo: **`core` no sabe que existe un navegador**. Recibe un
documento y devuelve otro documento, o recibe un documento y devuelve
posiciones. `editor` es una capa fina que convierte eventos del navegador en
llamadas a `core` y convierte el resultado de `core` en elementos del DOM.

## Cómo funciona

El ciclo completo de una pulsación de tecla:

```
tecla -> operación (ops) -> documento nuevo -> layout -> pintar páginas -> pintar caret
```

### 1. El modelo es un valor inmutable

Un documento es una lista de párrafos, y un párrafo es una lista de tramos
(`Run`) de texto con el mismo formato:

```ts
Doc       = { page, paragraphs }
Paragraph = { props, runs }        // props: alineación, sangrías, espaciado
Run       = { text, props }        // props: negrita, fuente, tamaño, color
Position  = { para, offset }       // párrafo y carácter dentro de él
```

Tabulador, salto de línea y salto de página son caracteres normales dentro del
texto (`\t`, `\n`, `\f`), así que una posición es siempre un número de
caracteres y no hay casos especiales al moverse o borrar.

Ninguna operación modifica el documento: devuelve uno nuevo que comparte con
el anterior todos los párrafos que no cambiaron. De ahí salen gratis dos cosas:

- **Deshacer** es guardar el documento anterior en una pila. No hay que
  invertir operaciones.
- **Saber qué cambió** es comparar referencias (`===`). El exportador lo usa
  para decidir qué párrafos reescribir.

### 2. Las operaciones son funciones puras

`ops.ts` tiene funciones como `insertText(doc, pos, text)` o
`deleteRange(doc, range)`. Todas terminan pasando por `normalizeRuns`, que
junta tramos vecinos con el mismo formato y garantiza que un párrafo nunca se
queda sin tramos. Con ese invariante, el resto del código no tiene que
defenderse de párrafos vacíos o tramos duplicados.

### 3. El layout lo calculamos nosotros

El navegador no sabe paginar, así que no le pedimos que acomode el texto.
`layout.ts` hace el trabajo en dos pasos:

1. **Cortar líneas.** Cada párrafo se parte en piezas (palabras, espacios,
   tabuladores, saltos). Se van colocando en la línea hasta que la siguiente
   palabra no cabe. Los espacios finales cuelgan fuera del margen, una palabra
   repartida entre varios tramos nunca se separa, y una palabra más ancha que
   la línea se corta por caracteres.
2. **Paginar.** Las líneas se apilan; cuando una no cabe en la página, empieza
   otra.

El resultado es una lista de páginas con líneas, y cada línea con fragmentos
que ya traen su coordenada exacta en puntos.

Un párrafo que es el mismo objeto que en el layout anterior, con el mismo
ancho y la misma etiqueta de lista, se corta igual. `layoutDocument` acepta un
`LayoutCache` que guarda las líneas por párrafo, así que al escribir solo se
vuelve a cortar el párrafo editado; el resto solo se vuelve a apilar.

La paginación sigue las reglas de Word, comprobadas contra Word con un
contrato real (ver más abajo):

- Entre dos párrafos queda el mayor de "espacio después" y "espacio antes",
  no la suma.
- Control de viudas y huérfanas (activo salvo que el párrafo lo apague),
  "conservar líneas juntas" y "conservar con el siguiente"; este último también
  mantiene juntas las filas de una tabla.
- En documentos que piden el layout de Word 2013 (`compatibilityMode` 15), una
  línea justificada puede encoger sus espacios hasta un 24,5 % para que quepa
  una palabra más, pero solo si dejarla fuera estiraría la línea claramente
  más de lo que meterla la aprieta.
- La cabecera y el pie quitan sitio al cuerpo cuando no caben en su margen.
- El grosor de los bordes horizontales de una tabla cuenta en la altura de
  sus filas.

Para medir, el layout recibe un `TextMeasurer` (ancho de un texto, ascendente
y descendente de una fuente). En el navegador es un canvas; en los tests es
una fuente falsa de ancho fijo, y por eso el layout se puede probar con
números exactos sin abrir un navegador.

### 4. Pintar es colocar, no maquetar

`editor.ts` crea un `div` por página y un `span` por fragmento, cada uno en
posición absoluta con las coordenadas que dio el layout. El navegador solo
dibuja glifos donde se le dice.

Las métricas de la fuente (ascendente, descendente y el interlineado que pide
la fuente) se leen a 200 pt y se escalan: al tamaño del texto el navegador las
redondea a píxeles enteros, que es un 5 % de la altura de una línea. El texto
se mide y se pinta sin kerning, como hace Word. Las fuentes que el documento
trae incrustadas se cargan desde el propio archivo si el sistema no las tiene.

**Por qué coincide lo medido con lo pintado:** el canvas que mide y el `span`
que pinta usan exactamente la misma cadena de fuente CSS (`cssFont` en
`measurer.ts`), y las coordenadas se pasan en `pt`, que CSS entiende
directamente. En la prueba de navegador la diferencia máxima entre el ancho
calculado y el ancho real de un `span` fue de 0,26 px.

Cada línea recuerda de qué caja de línea del caché salió. Una página cuyas
líneas son las mismas cajas en la misma posición no se vuelve a pintar.

El caret y la selección también son `div` nuestros. Su posición sale de las
mismas funciones de geometría del layout:

- `caretRect(pos)` — de posición a coordenadas
- `hitTest(página, x, y)` — de coordenadas a posición (clic)
- `selectionRects(range)` — un rectángulo por línea seleccionada

### 5. Las listas

Un párrafo de lista lleva el id de su lista y su nivel (`numId`, `listLevel`);
las definiciones (`numbering.xml`) viven en `doc.numbering`. La etiqueta no es
texto del párrafo: se calcula al hacer layout recorriendo el documento con un
contador por lista, y se coloca en la sangría francesa de la primera línea. Por
eso al borrar un elemento los siguientes se renumeran solos.

Las sangrías del nivel se resuelven al importar, con la precedencia de Word:
formato directo, luego el nivel, luego el estilo; salvo cuando es el estilo
quien mete al párrafo en la lista (títulos numerados), que entonces gana el
estilo. Las viñetas de Symbol y Wingdings se pintan como el carácter Unicode
equivalente en la fuente del párrafo, porque esas fuentes no suelen estar.

Editar una lista es cambiar esas dos propiedades (`toggleList`,
`shiftListLevel`, `leaveList` en `ops.ts`). Una lista nueva continúa la que
tenga justo antes o después si es del mismo tipo; si no, se crea una definición
nueva. El teclado sigue a Word: Tab y Mayús+Tab al inicio de un elemento
cambian el nivel, Enter en un elemento vacío sube un nivel y en el primero sale
de la lista, y Backspace al inicio quita primero la etiqueta, luego la sangría
y solo después une el párrafo con el anterior.

Al exportar, las definiciones creadas desde que se abrió el archivo se añaden
a su `numbering.xml` sin tocar las que ya tenía; si el paquete no tenía esa
parte, se crea junto con su tipo de contenido y su relación.

Las reglas de los contadores están portadas de WordCraft (ver
`THIRD_PARTY_NOTICES.md`).

### 6. Las tablas

El documento sigue siendo una lista plana de párrafos. Un párrafo de tabla
lleva una referencia a su celda (`cell`: tabla, fila, celda) y la forma de la
tabla (columnas, combinaciones, márgenes, bordes) vive aparte, en `doc.tables`.
Con eso las posiciones, las operaciones y el exportador no cambian: solo el
layout sabe de tablas.

El layout corta los párrafos de cada celda al ancho de su columna, hace cada
fila tan alta como su celda más alta y la coloca entera; si no cabe, pasa a la
página siguiente. Cada página guarda las cajas de sus celdas, que sirven para
pintar los bordes, para saber en qué celda cae un clic y para que las flechas
arriba y abajo se muevan por filas dentro de la misma columna.

Una fila que no cabe en lo que queda de página se parte entre líneas, celda
por celda, y sigue en la siguiente, como en Word. Se pasa entera a la página
siguiente si lo pide (`w:cantSplit`) o si no cabe ni la primera línea de
alguna de sus celdas.

Para que una tabla no pierda su forma, nunca se unen párrafos a través del
borde de una celda: borrar una selección que cruza celdas vacía el texto y deja
cada celda con sus párrafos, y Backspace al inicio de una celda no hace nada.
Tab y Mayús+Tab pasan a la celda siguiente o anterior.

El estilo de la tabla da formato a los párrafos de sus celdas, por debajo del
estilo del párrafo.

La forma de una tabla se cambia con las operaciones de `tables.ts`: crear una
en el cursor, y añadir o quitar filas y columnas. Los párrafos apuntan a su
celda por un identificador y no por su posición, así que al insertar una fila
los párrafos de las demás siguen siendo los mismos objetos y se exportan tal
como estaban. Una celda que abarca varias columnas crece o encoge con ellas, y
las celdas combinadas en vertical se mantienen coherentes. Tab en la última
celda añade una fila.

Al exportar, una tabla cuya forma cambió se escribe desde el modelo en el lugar
que ocupaba, reutilizando del archivo las propiedades de la tabla, de cada fila
y de cada celda que sigue existiendo (sombreados, bordes, estilos); las filas y
celdas nuevas toman las de sus vecinas. Una tabla que no se tocó se sigue
copiando tal cual.

### 7. Cabecera, pie e imágenes flotantes

La cabecera y el pie se leen del archivo como contenido aparte (`doc.header`,
`doc.footer`), se maquetan con el mismo motor y se pintan en cada página. Los
campos de número de página y total de páginas se rellenan por página.

Su texto se edita como el del documento. Un doble clic en el encabezado o en
el pie entra en él (también desde el menú de página, o con `setArea`); otro
doble clic en el texto, o Escape, vuelve. Mientras tanto el resto de la
página se atenúa, una línea con su nombre marca el borde, y escribir, borrar,
dar formato, deshacer y moverse actúan ahí. El editor no tiene operaciones
aparte para esto: ve el encabezado como un documento (`Editor.text`), le aplica
las mismas funciones puras y devuelve el resultado a su sitio. Para el cursor
y la selección, `bandLayout` da el encabezado de una página como un layout
propio. Si el documento no tenía encabezado o pie, al entrar se crea vacío, y
se quita si se deja vacío.

Dos cuidados con el número de página. Sus cifras no son las que guarda el
documento ("1") sino las de cada página ("12"), así que las posiciones se
convierten al ir y venir del layout (`mapFieldOffset`). Y lo que se escribe
pegado al número se pone fuera de las marcas del campo (`outsideField`): lo
que queda dentro es su resultado, y Word lo reescribe.

El número de página tiene además su propio panel (`setPageNumbering`): va en
el encabezado o en el pie, a la izquierda, al centro o a la derecha, como
"3", "3 / 9", "Página 3" o "Página 3 de 9", y se puede quitar. El número es un
párrafo propio con campos de verdad, así que Word lo recalcula. Ponerlo de
nuevo sustituye al que hubiera, también al que traía el archivo; un número que
comparte línea con otro texto ("Contrato 123 · 3") se deja como está.

Al exportar, un encabezado o pie que cambió se reescribe en su parte como se
hace con el cuerpo: los párrafos sin tocar se copian tal cual, los editados se
reconstruyen sobre el original (con sus propiedades y las marcas de sus
campos), también dentro de una tabla, y nada más del paquete se toca. Si el
documento no tenía, se crea la parte con su tipo de contenido, su relación y
la referencia en la sección.

Las imágenes flotantes se colocan donde dice su ancla, y el texto hace con
ellas lo que el archivo pide: nada (un logo sobre el texto o detrás), bajar
por un lado (ajuste cuadrado; el estrecho se trata igual, por su caja) o
dejarles todo el ancho (arriba y abajo). Antes de partir en líneas un
párrafo, sus imágenes toman sitio; si alguna de la página está en su camino,
el párrafo se parte para ese sitio —cada línea con el ancho que le queda— en
vez de usar el corte guardado en caché. El texto baja por los dos lados de
la imagen cuando en ambos queda al menos una pulgada (la línea va en dos
tramos sobre la misma línea base: dos `Line` a la misma altura), por uno si
solo cabe en uno o el archivo lo pide, y por debajo si no cabe en ninguno,
como en Word. Una línea empujada lleva ese hueco dentro de su altura
(`pad`), así que la paginación y la altura de un pie con una imagen así
salen solas.

Estas reglas salieron de comparar con Word, línea por línea e imagen por
imagen, y están en los tests:

- El texto va en la parte de arriba de su línea y el hueco que deja un
  interlineado mayor que el sencillo queda debajo. (El motor lo centraba: con
  interlineado doble el texto salía 6 pt más abajo que en Word.)
- La posición de una imagen se mide desde el inicio de su párrafo contando el
  espacio anterior del párrafo, no desde su primera línea.
- Una línea está "al lado" de una imagen cuando su caja entera, con el hueco
  del interlineado, toca la zona de la imagen (la imagen más la distancia que
  pide a su alrededor). De la última línea de un párrafo cuenta solo el
  texto: el hueco de debajo ya no es suyo. Como cuál es la última línea
  depende de cómo se parta, el párrafo se parte, se mira, y se vuelve a
  partir hasta que coincide.
- El texto baja por un lado de una imagen si quedan al menos 18 pt (un cuarto
  de pulgada): Word escribe en 20 pt y no en 12.
- Una palabra que no cabe a ningún lado baja entera hasta donde quepa.
- Una primera línea empujada bajo una imagen conserva encima el espacio
  anterior de su párrafo.
- Dentro de una celda de tabla el texto también rodea las imágenes de la
  celda, medidas desde la esquina de su contenido.
- Un párrafo que solo tiene el ancla de una imagen mide lo que diga su marca
  de párrafo.
- La última línea de una página puede pasarse de su pie hasta 1,5 pt.

`npm run float-cases` escribe en `fixtures/` doce documentos con imágenes
flotantes en las situaciones que un archivo puede pedir (a un lado, a los
dos, arriba y abajo, encima y detrás del texto, medidas desde la página o el
margen, ancladas a mitad de párrafo, con otros interlineados, al final de la
página, en una celda y en el encabezado, con poco sitio al lado). Cada
imagen es un bloque de un color, así que `npm run float-cases -- --check`
lee del PDF de Word dónde la puso y lo compara con el nuestro, y
`npm run word-compare` compara las líneas.

En el editor una imagen flotante se selecciona con un clic (sin mover la
vista, aunque su ancla esté lejos), se arrastra, cambia de tamaño por las
esquinas y se borra como cualquier otra. Al soltarla sobre otro párrafo
queda anclada a él, como en Word, y va con él a su página; se dibuja donde
se soltó. La barrita de ⌘ ofrece cómo va en el texto: en línea, con el
texto alrededor, arriba y abajo, sobre el texto o detrás de él. Pasar de
"en línea" a flotante y al revés cambia el dibujo (`wp:inline` ↔ `wp:anchor`)
y la marca que lo representa en el texto; una que sale de su línea se queda
donde estaba dibujada. Las de detrás se pintan antes que el texto y las
demás después, y un clic sobre texto que pasa por encima de una de detrás es
para el texto. En `@rebodocs/core`: `setPictureWrap`, `moveFloat`, `resizeFloat`
y `reanchorFloat`.

**Primera página distinta.** Si la sección lo pide (`w:titlePg`), la primera
página muestra su propio encabezado y pie (`doc.firstPage`), o ninguno si no
los tiene, y el área de texto de esa página se calcula con ellos. Se editan
como los demás: un doble clic en el encabezado de la primera página entra en
el suyo (la etiqueta lo dice), y en el de cualquier otra, en el de todas. Se
activa y se quita en el menú de página ("Primera página distinta"): al
activarla la primera página empieza sin encabezado ni pie, y al quitarla
muestra los de todas. Al
guardar, cada uno va a su parte; uno que no existía recibe la suya y su
referencia de primera página en la sección. Un número de página que el
archivo trae vacío (así los deja Google Docs) recibe un número que mostrar.
El resaltado del texto se pinta.

### 8. Los estilos de párrafo

Un estilo es un aspecto con nombre: Normal, Título, Subtítulo, Título 1 a 3.
El modelo guarda el formato de cada párrafo ya resuelto, así que aplicar un
estilo (`setParagraphStyle`) escribe su formato en el párrafo y anota su
nombre (`props.styleId`). El párrafo toma todo el formato de párrafo del
estilo, y su texto el tamaño, la negrita, la cursiva y el color; el subrayado,
el tachado, el resaltado y la lista en la que esté se conservan. Enter al
final de un título empieza un párrafo Normal.

Los estilos que se ofrecen (`paragraphStyles`) son los del documento. En un
archivo, los títulos son los suyos, con su aspecto, reconocidos por el nombre
interno de Word ("heading 1") aunque su identificador esté traducido; los que
no tenga se añaden sobre su Normal, y se suman los demás estilos que usen sus
párrafos. Un documento nuevo trae un juego estándar.

Al exportar, el párrafo lleva el nombre del estilo (`w:pStyle`), que es lo que
hace que Word lo trate como título, y además su formato escrito de forma
directa, como diferencia con lo que tenía. Si el paquete no definía el estilo,
se añade su definición a `styles.xml`; un documento nuevo recibe esa parte
solo si usa algún estilo.

### 9. La entrada de texto

Hay un `<textarea>` invisible que sigue al caret y tiene el foco. Lo que el
usuario escribe llega ahí, el editor lo lee, lo inserta en el modelo y vacía
el textarea. Las teclas de movimiento y los atajos se interceptan en
`keydown`.

Una palabra que el teclado compone (una tilde, un IME, y todo lo que escribe
el teclado de un teléfono) se ve en el documento mientras se compone, y
cambia con ella si el teclado la corrige: el editor compara lo que tiene el
textarea con lo que ya puso, y quita o añade la diferencia. El textarea
guarda siempre un carácter invisible delante, porque un teclado en pantalla
no avisa de un Retroceso en un campo vacío: con él, lo borra, y así se sabe.

### 10. DOCX sin pérdida

Un `.docx` es un ZIP de archivos XML. El modelo solo entiende una parte de lo
que Word puede guardar, así que la estrategia no es "convertir a mi modelo y
volver a generar", sino **conservar el original y reescribir solo lo tocado**:

- **Al importar** se guarda el paquete entero (`doc.source`) y, para cada
  párrafo, de qué `<w:p>` del XML original salió (`origin`). El parser XML
  guarda la posición de cada nodo en el texto fuente, lo que permite copiar
  trozos del original tal cual.
- **Al exportar**, un párrafo que es el mismo objeto que se importó se copia
  byte a byte. Uno editado se reconstruye sobre sus propiedades originales,
  cambiando solo los atributos que difieren de lo importado. Las demás partes
  (estilos, numeración, cabeceras, imágenes) se devuelven intactas.
- **Lo que el modelo no entiende viaja dentro del texto.** Marcadores, campos,
  rangos de comentario y texto eliminado con seguimiento se guardan como un
  carácter de ancho cero que lleva su XML original; las imágenes en línea,
  como un carácter con el tamaño de la imagen. Se mueven con el texto al
  editar, y el caret salta por encima de los invisibles. Hipervínculos e
  inserciones con seguimiento se guardan como un envoltorio del tramo.
- **Los estilos se resuelven al leer** (herencia incluida) para que el layout
  tenga valores concretos, pero al escribir se compara contra ese mismo
  cálculo: si no cambiaste la negrita, no se escribe negrita, y el párrafo
  sigue ligado a su estilo.

Al partir un párrafo con Enter, las dos mitades heredan las propiedades del
original, de modo que un elemento de lista sigue siendo lista.

Un documento creado desde cero no tiene original; se exporta como un paquete
mínimo con todo el formato escrito de forma directa.

### 11. La barra de herramientas

`createToolbar(contenedor, editor, opciones)` monta una barra que solo usa los
métodos públicos del editor, así que una aplicación puede usarla tal cual o
escribir la suya. Tiene:

- el nombre del documento (`title`), con una marca mientras tiene cambios sin
  guardar (`dirty`);
- deshacer y rehacer; estilo de párrafo, fuente y tamaño; negrita, cursiva,
  subrayado y tachado, con la letra de cada una en el idioma de la interfaz;
  color de texto y de resaltado;
- un botón de alineación, que muestra la del párrafo y abre las otras tres;
- un menú de párrafo con el interlineado, el espacio antes y después, y las
  opciones de paginación: viudas y huérfanas, conservar con el siguiente,
  conservar líneas juntas y salto de página antes;
- listas, y sangría: en una lista cambia el nivel, fuera de ella mueve el
  párrafo;
- un menú **Insertar** con todo lo que se pone en el documento: una rejilla
  para elegir el tamaño de una tabla nueva, imagen (varias van en cuadrícula),
  firmas, variable, enlace, nota, índice, salto de página y número de página.
  Para la variable, el enlace y la nota hace falta un texto: lo pide
  `onInsertVariable` / `onInsertLink` / `onInsertNote` (el playground abre la
  barrita de ⌘ con `bubble.ask`), o el navegador si no se dan;
- un menú de tabla, activo dentro de una tabla: combinar y dividir celdas,
  añadir y quitar filas y columnas, bordes y sombreado;
- un menú de página: editar el encabezado o el pie, y el número de página
  (sin número, arriba o abajo; la posición; y el formato, con el número real
  como ejemplo). El tamaño, la orientación y los márgenes están en el menú
  del documento;
- la lupa de buscar, al final de la barra.

Con `onMenu` la barra empieza con un botón de menú, que es el que abre el
menú del documento. `toolbar.refresh()` la pone al día cuando cambia algo que
no es del editor, como el nombre del archivo al guardar.

Cada control refleja la selección (activo, deshabilitado, color en uso, fuente
y tamaño, aunque el documento use unos que no estaban en la lista). Los clics
no le quitan el teclado al documento. Los botones llevan etiqueta accesible y
los menús se cierran con Escape o al hacer clic fuera.

Cada control dice qué es al dejar el puntero encima, o al llegar a él con el
teclado: un rótulo propio bajo el control (`data-tip`, no el `title` del
navegador, que tarda y no se puede vestir) con su nombre y, aparte, su atajo.
El primero tarda un tercio de segundo; al pasar de un control al de al lado
sale al momento. El de la tabla, cuando está apagada, dice qué la enciende.

La barra ocupa siempre una fila. Los grupos que no caben en el ancho que
tiene esperan, en su orden, bajo un botón "más" (⋯) puesto antes del de
buscar, y vuelven a la barra cuando hay sitio; el menú, el nombre del
documento y buscar no se van nunca. Los botones son los mismos, cambiados
de sitio, así que funcionan igual y sus menús se abren bajo ellos. Probado
de 1500 a 420 px de ancho.

### Menú del documento

`createSidebar(editor, opciones)` da un panel que entra por la izquierda, con
lo que se le hace al documento entero:

- **Archivo:** abrir, guardar y guardar como. Son de la aplicación, que dice
  qué hacen (`onOpen`, `onSave`, `onSaveAs`); cada entrada aparece si se da.
- **Exportar:** Word (`.docx`), PDF y Markdown (`.md`). Los archivos se
  descargan, o van a `onExport` si la aplicación quiere hacer otra cosa con
  ellos.
- **Configuración de la página…** abre un diálogo sobre el documento
  (`sidebar.openPageSetup()`): tamaño de papel (o ancho y alto a mano),
  orientación, y márgenes por preajuste o los cuatro en centímetros. Cada
  cambio se ve al momento detrás del diálogo; *Aceptar* (o Intro) lo deja,
  *Cancelar* (o Esc) vuelve a la página como estaba. Un margen no pasa de lo
  que deja sitio al texto.

El PDF (`editor.exportPdf()`) lo escribe el propio motor a partir del layout,
sin pasar por el navegador, y se descarga directo: cada página con su texto
donde está, los bordes y el sombreado de las tablas y las imágenes. El texto
es de verdad (se selecciona y se busca). Las fuentes que el archivo trae
incrustadas van dentro del PDF. Las demás no se pueden leer desde una página
web, así que el PDF nombra la más parecida de las tres que todo lector tiene
(Helvetica, Times, Courier, que miden lo mismo que Arial, Times New Roman y
Courier New) y coloca cada palabra donde el layout la midió, de modo que las
líneas no cambian de largo.

"Imprimir…" (`editor.print()`) abre además el diálogo de impresión del
navegador con las páginas tal como se ven, una hoja por página y a su tamaño;
guardado como PDF desde ahí, lleva las fuentes de esta máquina.

El Markdown (`exportMarkdown`) lleva lo que Markdown sabe decir: títulos (por
el estilo del párrafo), negrita, cursiva, tachado, listas con sus niveles y
tablas (la primera fila hace de cabecera). Lo demás va como texto: se pierden
fuentes, tamaños, colores, alineación, subrayado, imágenes, encabezado y pie.
Los caracteres que Markdown leería como marcas se escapan.

En la página de pruebas, abrir y guardar usan el acceso a archivos del
navegador donde existe (Chrome y Edge): guardar escribe en el mismo archivo
que se abrió. Donde no, guardar descarga una copia. ⌘S y ⌘O hacen lo mismo.

### Utilidades propias

El editor no tiene por qué limitarse a lo que hace Word. La regla es que todo
lo que añada se guarde en el DOCX de forma que Word lo abra y lo muestre bien.

**Plantillas con variables.** Una variable es texto entre llaves dobles,
`{{cliente}}`, así que cualquier DOCX puede ser una plantilla y Word la ve tal
cual. En el editor las variables se resaltan, y la pestaña *Variables* del
panel lateral (`createPanel`) las lista con una casilla para cada valor:
"Rellenar documento" las sustituye todas (en el texto, el encabezado y el
pie) como un solo paso de deshacer, y los valores escritos se conservan.
"Cargar datos…" los toma de un archivo JSON (`{"cliente": {"nombre": "Ana"}}`
rellena `{{cliente.nombre}}`). Para crear una, se escribe a mano o se
selecciona un texto y se inserta desde el panel. El valor toma el formato que
tenía la variable. Una variable partida en varios trozos por Word se
reconoce igual.

Tras el nombre, una variable puede decir cómo se escribe su valor, con un
formato detrás de cada barra: `{{fecha | fecha larga | mayúsculas}}`. Como
también es texto, Word lo conserva. Cada uso lleva los suyos, así que el mismo
dato puede salir de dos maneras en el mismo documento.

| Formato | Valor | Resultado |
|---|---|---|
| `fecha` | `2026-10-12`, `12/10/2026` u `hoy` | 12/10/2026 |
| `fecha larga` | | 12 de octubre de 2026 |
| `fecha completa` | | lunes, 12 de octubre de 2026 |
| `fecha: dd-MMM-aa` | | 12-oct-26 (`d`, `dd`, `dddd`, `M`…`MMMM`, `aa`, `aaaa`; lo demás va tal cual) |
| `número`, `número: 2` | `1234567.5` | 1,234,567.5 · 1,234,567.50 |
| `moneda`, `moneda: 0` | `1500` | $1,500.00 · $1,500 |
| `mayúsculas`, `minúsculas`, `nombre propio` | `ana pérez` | ANA PÉREZ · ana pérez · Ana Pérez |
| `negrita`, `cursiva`, `subrayado` | | el valor, con ese formato de carácter |

En el panel, cada variable tiene debajo de su valor los controles para
ponerlos (se aplican a todos sus usos) y una vista previa de cómo quedará. Un
valor que no sirve para su formato (una fecha que no existe, un importe con
letras) se pone tal cual, y el panel y `npm run generate` lo avisan
(`variableProblems`).

**Acciones junto a la selección.** `createBubble(editor)` da una barrita
flotante que aparece al lado de lo seleccionado con un toque a ⌘ sola (Ctrl
fuera de Mac), y se va con otro toque, Esc, un clic fuera o al seguir
escribiendo. Lo que ofrece depende de lo que haya: para un texto, negrita,
cursiva, subrayado, tachado, resaltar y convertirlo en variable; para una
variable, sus formatos; para una imagen, ponerla al 25, 50 o 100 % del ancho
del texto o quitarla; dentro de una tabla, filas, columnas, combinar o dividir
y sombrear. Con solo el cursor, en una línea vacía ofrece insertar (tabla,
imagen, variable, salto de página) y, en una escrita, el estilo del párrafo y
las listas primero.

**Firmas.** "Firmas" en esa barrita, o "Insertar firmas" en el menú de tabla
(`editor.insertSignatures(['ASESOR', 'CLIENTE'])`), pone dos huecos para
firmar uno al lado del otro: una tabla de una fila sin bordes, y en cada celda
quién firma (ASESOR y CLIENTE, si no se dice otra cosa), una línea y un nombre
debajo, centrados y en negrita. Queda seleccionado el primer nombre para escribir encima.
En el archivo es una tabla corriente, que Word abre y edita como cualquier otra.

**Imágenes en cuadrícula.** El botón de imagen deja elegir varios archivos a
la vez. Con más de uno se abre un diálogo (`openImageGrid`) que las muestra
como quedarán: se elige cuántas van por fila (de 1 a 6), se arrastran para
cambiar el orden, se quitan o se añaden más, y "Insertar" las pone todas de un
solo paso de deshacer. En el documento es una tabla sin bordes con una imagen
por celda (`insertImageGrid`), cada una al mayor tamaño que cabe en el cuadro
de su columna, sin deformarla y centrada: Word la abre como una tabla
corriente, y cada imagen se sigue pudiendo mover o cambiar de tamaño.

**Notas.** Una nota es un comentario sobre un trozo del texto, y en el archivo
es exactamente un comentario de Word: el texto lleva las marcas
`w:commentRangeStart` y `w:commentRangeEnd`, y la nota va en
`word/comments.xml`, así que Word la muestra en su margen y las que traiga un
documento de Word aparecen aquí. Las marcas no ocupan sitio y viajan con el
texto al editarlo. Se añade desde la pestaña *Notas* del panel (se escribe y
"Añadir nota" la pone en la selección, o en la palabra del cursor) o desde la
barrita de ⌘ con texto seleccionado, que pide ahí mismo el texto, el color y el nombre. El texto anotado se resalta en ámbar, más
fuerte donde está el cursor; la pestaña lista cada nota con su cita (un clic
lleva a ella), su texto editable, quién la escribió y cuándo, y un botón para
quitarla. El nombre con que se firman se pide una vez y se recuerda
(`editor.author`). Un comentario del archivo que no se toca se escribe byte a
byte como estaba; al guardar se descartan las notas cuyo texto se borró
(`pruneNotes`). No se imprimen ni salen en el PDF.

Al pasar el ratón por un texto anotado sale su nota junto al puntero, con
quién la escribió; donde una nota está dentro de otra, sale la de dentro. Cada
nota tiene un color, elegido entre seis en la pestaña (para la siguiente nota,
y en la tarjeta de cada una). Word no tiene color por comentario, así que se
guarda aparte, en una propiedad personalizada del documento (`DxNoteColors`
en `docProps/custom.xml`), de las que Word conserva al guardar; cada color va
unido a su nota por autor, fecha y comienzo del texto, no por su número, que
Word cambia al guardar.

Un botón de la barra de estado (`editor.setShowNotes`) muestra las notas en un
margen a la derecha de cada página, como los comentarios de Word: cada una a
la altura de su texto, bajando lo justo donde la de arriba no deja sitio, con
su color y su autor. Un clic en una selecciona su texto. El margen cuenta al
ajustar el zoom al ancho, y no se muestra en la cuadrícula de páginas ni al
imprimir.

**Índice.** *Insertar › Índice* (o la barrita de ⌘ en una línea vacía, o el
botón al pie de la pestaña *Esquema*) pone en el cursor una tabla de
contenido: el título "Índice" y una línea por cada título de nivel 1 a 3, con
los subniveles sangrados, puntos guía y el número de su página a la derecha.
En el archivo es el campo `TOC` de Word, con sus marcas alrededor de las
entradas, así que Word lo reconoce y lo puede actualizar él mismo; cada
entrada lleva una tabulación derecha con relleno de puntos (`leaderTab`, que
el layout y el PDF dibujan). `editor.updateToc()` lo vuelve a escribir con los
títulos y las páginas de ahora; se hace solo al guardar, exportar o imprimir,
y a mano con el botón "↻ Actualizar índice" que aparece sobre el propio
índice, con *Insertar › Actualizar índice* o desde el panel. Cada entrada es
un enlace a su título, como los hace Word: un `w:hyperlink` a un marcador
`_Toc…` que rodea el título, así que un clic en la entrada lleva a él (aquí
y en Word) aunque el título se haya movido; arrastrar sobre las entradas las
selecciona. Un documento tiene un solo índice, fuera de tablas.

Comprobado en Word para Mac el 2026-10-12 con el documento de ejemplo: lo
abre sin reparar nada, con 4 páginas como aquí, reconoce 1 tabla de contenido
con 10 enlaces y 3 comentarios sobre su texto, la actualiza con su propio
"Actualizar campo" dejando las mismas páginas, y al guardarlo conserva la
propiedad con los colores de las notas; el archivo guardado por Word se
vuelve a abrir aquí con su índice actualizable y sus enlaces.

**Enlaces.** *Insertar › Enlace*, ⌘K o la barrita de ⌘ convierten el texto
seleccionado en un enlace: se pide la dirección y el texto queda azul y
subrayado. Sin nada seleccionado se escribe la propia dirección como enlace.
Vale una página (`ejemplo.com` pasa a `https://ejemplo.com`), un correo (pasa
a `mailto:`) o un teléfono (`tel:`); lo demás, como `javascript:`, se rechaza
(`cleanHref`). Al pasar el puntero se ve a dónde va, y se abre con ⌘ y un
clic, como en Word; con el cursor dentro, la barrita de ⌘ ofrece abrirlo,
cambiar la dirección o quitarlo. Lo que se escribe justo después de un enlace
ya no es enlace. Una dirección tecleada (`https://…`, `www.…` o un correo) se
vuelve enlace al dar al espacio, como en Word, sin llevarse el punto o el
paréntesis que la siga; ⌘Z la deja como texto. En el PDF los enlaces se
pueden pulsar, y también las entradas del índice, que llevan a su título. En el archivo es el `w:hyperlink` de Word con su relación
externa en la parte que lo contiene (documento, encabezado o pie); en el
modelo la dirección viaja en el propio envoltorio del texto
(`r:id="dx:dirección"`), tanto para los enlaces hechos aquí como para los que
traía el archivo, y al exportar se le da su relación, reutilizando la que ya
hubiera para esa dirección. En `@rebodocs/core`: `setLink`, `removeLink`,
`insertLink`, `linkAt` y `linkHref`.

**Generación sin navegador.** El núcleo corre en Node, así que una plantilla
se rellena y se convierte sin abrir el editor:

```
npm run generate -- plantilla.docx --list                    # sus variables
npm run generate -- plantilla.docx datos.json -o salida.docx
npm run generate -- plantilla.docx datos.json -o salida.pdf  # o .md
```

o desde código: `exportDocx(fillVariables(importDocx(bytes), datos))`. Para el
PDF no hay navegador que mida el texto, así que `renderPdf(doc, fuentes)`
pagina con los propios archivos de fuente (`FontMeasurer`), que son los mismos
números que da el navegador, y los incrusta recortados a los glifos usados.
La herramienta busca los `.ttf` en las carpetas de `--fonts` y en las del
sistema; si falta una familia usa la más parecida y avisa, porque entonces
las líneas pueden cortar en otro sitio.

**Esquema.** La pestaña *Esquema* lista los títulos del documento, con el del
cursor marcado. Un clic lleva a ese título; arrastrar uno sobre otro mueve su
sección entera (el título y todo lo que cuelga de él, tablas incluidas) justo
encima, o al final si se suelta abajo. Al exportar un DOCX reordenado, cada
bloque se escribe tal como estaba en el archivo, en su nuevo sitio.

**Formato al escribir.** `# `, `## ` y `### ` al empezar un párrafo lo
convierten en Título 1, 2 o 3; `- ` o `* ` empiezan una lista con viñetas y
`1. ` una numerada; `**texto**` queda en negrita, `*texto*` en cursiva y
`~~texto~~` tachado. La conversión es un paso propio de deshacer: ⌘Z deja lo
que se tecleó. Se apaga con `editor.autoformat = false`.

### Asistentes de IA (MCP)

`packages/mcp` es un servidor del [Model Context Protocol](https://modelcontextprotocol.io):
lo que un asistente (Claude Desktop, Claude Code, Cursor…) usa para leer y
cambiar documentos. Trabaja sobre dos clases de documento con las mismas
herramientas:

- **Archivos.** `open_document` lee un `.docx` y lo deja en memoria; las
  herramientas lo cambian ahí, y nada se escribe hasta `save_document`, que
  guarda en DOCX, PDF o Markdown según la extensión. No escribe encima de un
  archivo que ya existe salvo que se le diga `overwrite`: lo normal es guardar
  una copia. No hace falta tener el editor abierto.
- **El editor abierto.** Con el botón **IA** de la barra de abajo la página se
  conecta al servidor de este equipo, y el asistente trabaja sobre el
  documento que se ve (`"document": "editor"`). Cada cosa que hace es un paso
  de deshacer, y la vista salta a donde cambió. El punto del botón dice el
  estado: gris apagado, ámbar buscando el servidor, verde conectado. No se
  conecta solo ni se acuerda entre recargas: lo enciende la persona. Puede
  haber varios editores conectados a la vez (varias pestañas, o varias
  personas): cada uno tiene su número, `list_documents` los nombra con el
  archivo que tienen abierto y se eligen con `"editor:2"`.

Para conectarlo, en la configuración del cliente (rutas absolutas):

```json
{
  "mcpServers": {
    "docs": {
      "command": "node",
      "args": ["/ruta/al/repo/packages/mcp/bin/rebodocs-mcp.mjs", "--root", "/Users/yo/Documentos"]
    }
  }
}
```

o `npm run mcp` para arrancarlo a mano. `rebodocs-mcp.mjs` es un lanzador: el
servidor es TypeScript ejecutado tal cual, y hay que decirle dónde está el
repositorio, porque el cliente lo arranca desde una carpeta suya. Opciones: `--root carpeta` (repetible)
limita a esas carpetas lo que puede leer y escribir —sin ninguna, cualquier
ruta—; `--fonts carpeta` añade fuentes para el PDF y las páginas; `--port`
cambia el puerto del editor (7411; la página lo recibe con `?mcp=http://127.0.0.1:puerto`);
`--no-editor` deja solo los archivos; `--origin https://…` admite un editor
servido desde otro sitio que no sea este equipo.

**Varios asistentes a la vez.** Cada cliente arranca su propio servidor, y
solo uno puede escuchar en el puerto. El primero se queda con los editores y
los demás le preguntan a él, así que todos llegan a los mismos editores; si
el primero se cierra, otro toma el puerto y las páginas se reconectan solas.

**El editor en otro equipo.** Con `--host 0.0.0.0 --token una-palabra-larga`
el servidor escucha en la red, y la página de otro equipo se conecta con
`?mcp=http://ip-del-servidor:7411&token=una-palabra-larga`. Sin la palabra
(12 caracteres o más, obligatoria al abrir el servidor a la red) no entra
nadie de fuera. Va sin cifrar: sirve en una red de confianza, y una página
servida por `https` no puede hablar con un servidor `http` de otro equipo
(el navegador lo bloquea), así que para eso hace falta ponerle delante un
proxy con TLS.

Las herramientas (30): `get_overview`, `read_document`, `find_text`,
`replace_text`, `insert_paragraphs`, `delete_paragraphs`, `set_style`,
`set_list`, `format_text`, `set_link`, `list_links`, `add_note`, `list_notes`,
`remove_note`, `list_variables`, `fill_variables`, `insert_table`,
`edit_table`, `insert_image`, `edit_image`, `insert_signatures`, `set_page_number`,
`insert_page_break`, `insert_table_of_contents`, `update_table_of_contents`,
y las del servidor: `open_document`, `new_document`, `save_document`,
`list_documents`, `close_document`. Las de leer y escribir texto valen
también para el encabezado y el pie con `"area": "header"` o `"footer"`
(`"first_header"` y `"first_footer"` para los de la primera página, cuando
tiene los suyos), que tienen sus propios párrafos numerados, y ahí caben
también tablas e imágenes.
`edit_table` cambia la forma de una tabla ya hecha (filas, columnas, ancho de
las columnas, combinar y dividir celdas, sombreado, bordes, borrarla).
`insert_image` pone una imagen de un archivo: lo lee el servidor, también
cuando el documento es el del editor; `edit_image` la cambia de tamaño, la
mueve a otro párrafo, la alinea o la quita. Los
párrafos van por número, como los muestra `read_document`; un sitio dentro de
un párrafo, por su texto exacto, y si aparece varias veces la herramienta
pregunta cuál. Lo que el asistente hace mal (un texto que no está, un estilo
que no existe) vuelve como resultado con error y la pista para corregirlo.

Cómo está hecho:

- Las herramientas son funciones puras `(documento, argumentos) → texto y
  documento nuevo` sobre el núcleo, así que son las mismas en el servidor y en
  la página: en vivo, el servidor manda el nombre y los argumentos, y es la
  página la que la ejecuta sobre su documento (`connectAssistant`, que solo
  pide al editor `doc`, `edit`, `pagesOf` y `exportDocx`).
- El protocolo está escrito a mano (inicio, lista de herramientas y llamadas,
  un mensaje JSON por línea), sin dependencias.
- El camino al editor es un servidor HTTP en `127.0.0.1`: la página escucha
  con `EventSource` y responde con `POST`. Solo admite páginas de este equipo
  (`localhost`) o de los orígenes dados con `--origin`; el navegador siempre
  dice de dónde viene una página, y lo demás recibe un 403. Los otros
  servidores del equipo le hablan por `/peers` y `/call`, que solo atiende a
  quien llama desde el propio equipo y sin origen, es decir, a lo que no es
  una página.
- Para que el encabezado y el pie lleven tablas e imágenes puestas aquí, la
  exportación a DOCX las escribe en su parte con sus propias relaciones: una
  tabla nueva va entera donde están sus párrafos, y lo que la parte traía
  del archivo se sigue copiando tal cual.
- Las páginas del índice y el PDF, sin navegador, salen de los archivos de
  fuente del equipo, como en `npm run generate`.

Comprobado con el servidor real por entrada y salida estándar y el editor en
Chrome sin ventana: conectar, leer, reemplazar, anotar, insertar, actualizar
el índice, deshacer, guardar lo del editor en DOCX y PDF, y trabajar después
sobre ese archivo; cambiar el encabezado, mover el número de página, añadir
una fila a una tabla e insertar una imagen; y dos servidores con dos
pestañas, cada una con su editor, incluido cerrar el primero y que el segundo
tome su sitio. El acceso desde otro equipo solo tiene tests en este mismo
equipo, con otro origen y la palabra. Como cliente independiente se probó
el inspector oficial (`npx @modelcontextprotocol/inspector --cli`), que
lista las herramientas y las llama; fue el que descubrió que el servidor no
arrancaba desde otra carpeta, y de ahí el lanzador. **No está probado con un
asistente de verdad** (Claude Desktop u otro) usándolo en una conversación.

Quien conecta su asistente le envía el contenido del documento a su
proveedor: con documentos confidenciales, es una decisión de cada uno.

### Varias personas a la vez

Dos o más personas, cada una en su red, trabajan en el mismo documento y ven
lo que escriben las demás y dónde tiene cada una el cursor. Todas se conectan
a un mismo servidor, que es el que hay que tener en un sitio al que lleguen:

```
npm run build                                   # el editor, en apps/playground/dist
REBODOCS_COLLAB_TOKEN=una-palabra-larga npm run collab -- --host 0.0.0.0 --static apps/playground/dist
```

Con `--static` ese servidor sirve también el editor, y entonces basta una
dirección: quien la abre pulsa **Compartir** en la barra de abajo, escribe la
palabra y recibe un enlace (`…/?room=…`) para pasar a los demás. Quien abre
el enlace entra sin más: el nombre de la sala es largo, aleatorio y es lo
único que hay que guardar. Sin `--token`, cualquiera que llegue al servidor
puede empezar a compartir en él. Si el editor está alojado en otra parte, la
página busca el servidor en `?collab=https://…`, o en el puerto 7420 de su
mismo equipo.

| Opción | Para qué |
| --- | --- |
| `--port 7420` | El puerto. |
| `--host 0.0.0.0` | Aceptar conexiones de otros equipos; sin ella, solo este. |
| `--data carpeta` | Guardar las salas en una carpeta (`salas/` si no se dice otra cosa). |
| `--memory` | No guardar nada: las salas duran lo que dure el servidor. |
| `--backend url` | Los documentos son de otro sistema; ver más abajo. Su clave, en `REBODOCS_COLLAB_BACKEND_KEY` (o `--backend-key`). |
| `--token palabra` | La palabra que se pide para empezar a compartir. Mejor en `REBODOCS_COLLAB_TOKEN`: lo que va en la línea de comandos se ve en la lista de procesos. |
| `--static carpeta` | Servir además el editor ya construido. |

El servidor habla HTTP sin cifrar. En internet va detrás de algo que ponga
HTTPS (Caddy, nginx, un túnel): una página servida por HTTPS no puede hablar
con un servidor que no lo sea, y sin cifrar el documento viaja a la vista.
El intermediario no debe retener las respuestas (`/collab/…/events` es un
flujo que no termina).

**Dentro de otro sistema.** Con `--backend` el servidor no guarda nada: los
documentos son los de un sistema que ya los tiene (en R2, en disco o donde
sea), y que también decide quién puede editarlos. Una sala es entonces un
documento de ese sistema, con el id que tenga allí (de 8 a 64 letras, cifras,
`-` o `_`), y solo está en la memoria del servidor mientras hay alguien
dentro.

```
REBODOCS_COLLAB_BACKEND_KEY=clave-larga npm run collab -- --host 0.0.0.0 --backend https://api.misistema.com/collab
```

El sistema tiene que responder a tres rutas, que el servidor llama con
`Authorization: Bearer clave-larga`:

| Ruta | Qué hace |
| --- | --- |
| `GET url/<id>` | Devuelve el DOCX. El nombre, en la cabecera `X-Document-Name` (codificado como URL). 404 si no existe. |
| `PUT url/<id>` | Recibe el DOCX como está ahora, para guardarlo. |
| `POST url/<id>/access` | Recibe `{ "ticket": "…" }`. Responde 200 con `{ "name": "…" }` si quien tiene ese pase puede editar el documento; cualquier otra cosa es que no. |

El pase es lo que el sistema quiera: lo genera él para su usuario (un token
firmado de pocos minutos, por ejemplo) y lo pone en la dirección con la que
abre el editor, `…/?room=<id>&ticket=<pase>&collab=https://…`. El servidor no
lo interpreta, solo lo devuelve para que el sistema diga sí o no, y con qué
nombre se ve a esa persona. Sin pase válido no se entra ni se pueden pedir
los archivos de la sala, y nadie puede crear salas por su cuenta.

El documento vuelve al sistema cada 30 segundos mientras cambia
(`--save-every`), al quedarse la sala vacía y al parar el servidor con una
señal. Si el servidor se cae de golpe se pierde lo hecho desde la última
entrega; los editores que estaban abiertos conservan su copia. Si el sistema
no responde, los cambios se quedan en el servidor y se vuelve a intentar. El
servidor es un solo proceso con las salas en memoria: no se reparte entre
varias instancias ni corre en funciones sin servidor.

**Cómo funciona.** Nadie envía el documento, sino lo que cambió en él
(`changes.ts`): texto puesto o quitado en un párrafo, un párrafo partido o
unido, su formato, la forma de una tabla. Cada cambio nombra el párrafo por
un `id` que no cambia aunque entren y salgan párrafos alrededor, y no por su
posición. El editor no sabe nada de esto: sigue produciendo un documento
nuevo en cada edición, y la sesión (`session.ts`) saca los cambios comparando
el de antes con el de después, lo que es barato porque los párrafos sin tocar
son el mismo objeto.

El servidor (`server.ts`) tiene por sala el archivo del que se partió y la
lista de cambios, en el orden en que todos deben aplicarlos; ese orden único
es lo que garantiza que acaben con el mismo documento. Lo que uno escribe se
ve al instante en su pantalla; si entretanto llegó antes un cambio de otro,
el servidor reajusta el suyo para que siga significando lo mismo (escribir
tres letras antes mueve tres sitios lo que iba detrás) y el editor rehace los
suyos encima. Los cambios a la vez en el mismo párrafo se conservan los dos;
en la forma de una misma tabla, el encabezado entero cuando se crea, los
estilos o la página, gana el último, y los párrafos de la tabla se cuadran
con la forma que quedó.

Deshacer quita solo lo propio: en una sala la pila guarda los cambios
inversos, no el documento como estaba, y se reajustan con lo que hacen los
demás. Los cursores ajenos se dibujan con su color y su nombre, y se quedan
en su letra cuando alguien escribe antes.

Cuando la sala se queda vacía, el servidor aplica los cambios al archivo y
empieza de nuevo desde él (guarda el anterior al lado, una vez). Si se corta
la conexión, el editor sigue funcionando y envía lo pendiente al volver. El
asistente de IA conectado al editor de una persona edita para todas, porque
sus cambios pasan por el mismo camino que los de teclado; eso no se probó
aparte.

Comprobado: 45 tests (cambios, reajustes, servidor con varios clientes,
imágenes y notas hechas a la vez, reconexión, reinicio del servidor, y el
modo con otro sistema: pases, entrega del documento y reintento) y, en Chrome sin ventana con dos pestañas,
compartir, entrar por el enlace, escribir los dos a la vez en el mismo
párrafo sin perder letras, Enter de uno mientras escribe el otro, deshacer
solo lo propio, una tabla hecha por uno y rellenada por el otro, negrita,
encabezado, y que ambos exportan el mismo DOCX. También el modo de un solo
servidor por la IP de la red local, y el modo `--backend` con un sistema de
mentira que guarda un archivo y reparte dos pases. **No está probado entre
dos equipos de redes distintas, ni detrás de HTTPS, ni con un backend ni un
R2 de verdad.**

### Dentro de otra aplicación (React, Next.js)

`@rebodocs/react` es el editor completo como un componente: el documento con su
barra, regla, panel y barra de estado, en el hueco que se le dé. Lleva dentro
todo lo que necesita; solo React lo pone el proyecto que lo usa.

```
npm run build:react        # deja packages/react/rebodocs-react-0.1.0.tgz
```

En el otro proyecto, `npm install ruta/a/rebodocs-react-0.1.0.tgz`, y:

```tsx
'use client';
import { DocsEditor } from '@rebodocs/react';

export function Contrato({ id, pase }: { id: string; pase: string }) {
  return (
    <div style={{ height: '100%' }}>
      <DocsEditor
        collab={{ url: 'https://colab.misistema.com', room: id, ticket: pase }}
        features={{ assistant: false, files: false }}
      />
    </div>
  );
}
```

El componente ocupa el alto de lo que lo contiene: algo tiene que dárselo. En
el servidor dibuja un elemento vacío; el editor se monta en el navegador.

| Propiedad | Qué hace |
| --- | --- |
| `collab` | El documento es una sala: servidor, id y pase. Lo trae la sala, y se guarda solo. |
| `docx` | Sin `collab`: el DOCX que se abre. Sin ninguno de los dos, uno vacío. |
| `onSave` | Recibe el DOCX cuando la persona guarda (menú o ⌘S). Sin `collab`, es la forma de guardar. |
| `name`, `author`, `locale` | Nombre del documento, quién es la persona, e idioma (`es`, `en`). Se pueden cambiar sin volver a montar. |
| `fonts`, `locales` | Fuentes propias (`[{ family, src }]`) e idiomas además de español e inglés (`{ fr: textos }`). Ver [Fuentes](#fuentes) e [Idiomas](#idiomas). |
| `onChange`, `onCollab`, `onError` | Avisos: cambió el documento; cambió la conexión o quién está; algo falló (si no se da, sale un `alert`). |
| `onReady` o `ref` | Dan el editor: `exportDocx()`, `dirty`, `editor`, `collab`. |

Lo que una aplicación propia puede no querer está apagado hasta que se pide,
y lo que todo documento necesita, encendido hasta que se quita, en `features`:

| Opción | Por defecto | Qué es |
| --- | --- | --- |
| `menu` | sí | El menú del documento: exportar y configurar la página. |
| `panel` | sí | El panel lateral: esquema, variables y notas. |
| `ruler`, `statusBar`, `find`, `title` | sí | Regla, barra de estado, buscar y el nombre en la barra. |
| `files` | no | Abrir un archivo del disco en lugar del documento, y guardar una copia. |
| `language` | no | Elegir el idioma en el menú. |
| `assistant` | no | El botón IA (servidor MCP); `true`, o `{ url, token }`. |
| `share` | no | El botón Compartir, para abrir una sala desde aquí: `{ url, token, link }`. |
| `responsive` | sí | Adaptarse a una ventana angosta, como la de un teléfono: ver [Pantallas angostas y táctiles](#pantallas-angostas-y-táctiles). |

Con `collab` y un pase, el nombre de la persona es el que dice el sistema: no
se puede cambiar en el panel, que tampoco ofrece enlace ni salir de la sala.
Sin React, lo mismo se hace con `mountDocs(elemento, opciones)`, de
`@rebodocs/react/mount`, que devuelve el editor y su `destroy()`.

**Con interfaz propia (headless).** Quien quiera dibujar su barra con sus
estilos usa las mismas piezas sin la interfaz incluida: un proveedor que
tiene el documento, el elemento donde van las páginas, y un hook con lo que
hay que mostrar y lo que se puede hacer. Nada de eso trae aspecto propio.

```tsx
'use client';
import { DocsProvider, DocsSurface, useDocs } from '@rebodocs/react';

function Barra() {
  const { state, commands, docs } = useDocs();
  return (
    // Sin esto, pulsar un botón le quita la selección al documento.
    <div className="flex gap-1 border-b p-2" onMouseDown={(e) => e.preventDefault()}>
      <button aria-pressed={state.bold} onClick={() => commands.toggleMark('bold')} className="rounded px-2 aria-pressed:bg-indigo-600 aria-pressed:text-white">B</button>
      <button disabled={!state.canUndo} onClick={() => commands.undo()} className="rounded px-2 disabled:opacity-30">Deshacer</button>
      <button disabled={!state.dirty} onClick={() => docs?.save()} className="ml-auto rounded bg-indigo-600 px-3 text-white">Guardar</button>
    </div>
  );
}

export function Documento({ archivo, guardar }: { archivo: Uint8Array; guardar: (docx: Uint8Array) => Promise<void> }) {
  return (
    <div className="flex h-full flex-col">
      <DocsProvider docx={archivo} name="Contrato.docx" onSave={guardar}>
        <Barra />
        <DocsSurface className="min-h-0 flex-1 bg-slate-100" />
      </DocsProvider>
    </div>
  );
}
```

| Pieza | Qué es |
| --- | --- |
| `DocsProvider` | Tiene el documento. Recibe lo mismo que `DocsEditor` menos `features` y `locale`: `docx`, `collab`, `name`, `author`, `onSave`… |
| `DocsSurface` | Las páginas. Se desplaza solo, así que necesita un alto. Sus clases son las que se le den. |
| `useDocs()` | `state`, `commands`, `docs`, `editor` y `ready`. Quien lo usa se vuelve a dibujar cuando cambia el estado, y solo entonces. |
| `useDocsValue(fn, vacío)` | Otra cosa del documento, sacada del editor: `editor.outline`, `editor.notes`, `editor.styles`, `editor.variables`. |

`state` son valores sueltos: `bold`, `italic`, `fontFamily`, `fontSize`,
`color`, `align`, `styleId`, `list`, `link`, `canUndo`, `canRedo`,
`inTable`, `pictureSelected`, `page`, `pageCount`, `zoom`, `findCount`,
`name`, `dirty`, `collab`, `peers`, `me`. `commands` son los métodos del
editor que llamaría un botón (`toggleMark`, `setRunProps`,
`setParagraphStyle`, `toggleList`, `insertTable`, `setLink`, `addNote`,
`find`, `setPage`, `setZoom`… unos cincuenta), y devuelven el teclado al
documento después. `docs` tiene lo demás: `save()`, `download()`,
`openFile()`, `share()`, `leave()`, `connectAssistant()`, `exportDocx()`.

Lo que en la interfaz incluida son paneles y diálogos, aquí son hooks que dan
qué mostrar y qué hacer, para dibujarlos como se quiera:

| Hook | Da |
| --- | --- |
| `useDocsFind()` | `query`, `setQuery`, `options`, `count`, `index`, `next`, `previous`, `replace`, `replaceAll`, `close`. Busca mientras se escribe sin quitarle el teclado al campo. |
| `useDocsLink()` | `active` (dirección y texto), `possible`, `set`, `remove`, `open`. |
| `useDocsNotes()` | `notes`, `active`, `add`, `setText`, `setColor`, `remove`, `select`. |
| `useDocsOutline()` | `items`, `active`, `goTo`, `move`. |
| `useDocsVariables()` | `names`, `active`, `insert`, `select`, `fill`. |
| `useDocsStyles()` | `styles`, `active`, `set`. |
| `useDocsPage()` | `page`, `set`, `numbering`, `setNumbering`, `firstPageDifferent`. |
| `useDocsSelectionBox()` | Dónde está la selección en la pantalla, para poner al lado un panel propio. |
| `useDocsResponsive(600)` | Ajusta las hojas al ancho cuando el documento tiene menos de ese ancho, y da `narrow` y `keyboard` (los píxeles que tapa el teclado en pantalla). |

La regla y el globo de acciones junto a la selección no tienen versión sin
aspecto.

Un reset de estilos que limite el ancho de toda imagen (`img{max-width:100%}`,
el de Tailwind) dejaba en nada las del documento; el editor ya no lo
hereda.

Las páginas no se estilan: dónde va cada letra se calcula. Sí lo de
alrededor: el fondo con una clase en `DocsSurface`, y `--dx-canvas`,
`--dx-page-shadow`, `--dx-selection` y `--dx-caret` para el resto. El estilo
base del lienzo va en una capa de CSS (`@layer dx`) puesta antes que
cualquier otra, para que una clase de Tailwind gane siempre. Sin React,
`createDocs(elemento, opciones)` da lo mismo: `state()`, `subscribe()`,
`commands`.

Comprobado en una aplicación de Next.js 16 con React 19 hecha para la
prueba: compila con sus tipos, la página se dibuja en el servidor sin el
editor, se monta en el navegador, ⌘S entrega el DOCX, activar `files` hace
aparecer Abrir, y dos pestañas con `collab` y pases distintos editan el mismo
documento. Con los hooks, un buscador, un esquema y botones de enlace, nota
y margen hechos en la página de prueba buscan, reemplazan, saltan al título
y cambian el documento. Con Tailwind 4 en esa misma aplicación, una barra hecha con sus
clases: negrita, centrar, estilo desde un `select`, deshacer, tabla y
guardar reflejan y cambian el documento, y `bg-amber-50` en `DocsSurface`
sustituye al fondo. Con el reset de Tailwind la interfaz incluida se ve
igual que sin él. El menú, la búsqueda y el globo de acciones se ponen sobre toda la
página, no solo sobre el componente: en una aplicación con ventanas propias
puede hacer falta ajustar qué queda encima. Los estilos del editor llevan el
prefijo `dx-` y no usan los de la aplicación, pero una hoja de estilos que
cambie `button` o `input` en toda la página también los cambia aquí.

### Membrete

El papel de la empresa: una imagen del tamaño de la página, con su logo, su
fondo y su pie, bajo el texto de todas las páginas. Es lo que Word tiene
cuando se pone una imagen en el encabezado, detrás del texto y medida desde
la página, así que un documento que ya lo trae se reconoce (`hasLetterhead`),
y uno al que se le pone aquí se abre en Word con él.

En el menú del documento, bajo "Página": **Membrete…** elige un PNG o un JPG
del disco, y cuando ya hay uno pasa a **Cambiar el membrete…**, con
**Ajustar los márgenes al membrete**, **Extraer el membrete** (descarga la
imagen tal como está en el documento, para usarla en otro) y **Quitar el
membrete** debajo. Desde código, `editor.setLetterhead(bytes, tipo)`,
`setLetterheadFile(archivo)`, `fitLetterheadMargins()`, `letterhead` (la
imagen) y `removeLetterhead()`; en el componente sin
interfaz, `state.letterhead` y `useDocsPage()`.

Al ponerlo desde un archivo, los márgenes de arriba y de abajo crecen lo
justo para que el texto no pise lo que el membrete imprime ahí: se leen los
píxeles de la imagen, se busca dónde acaba lo impreso arriba (un logo) y
dónde empieza lo de abajo (una dirección), y se dejan 18 pt de aire. Lo tenue
(un patrón de fondo) y lo que está en mitad de la página no cuentan. Los
márgenes solo crecen, nunca se encogen, y van en el mismo paso de deshacer.
Con `setLetterheadFile(archivo, false)` no se tocan.

Una aplicación que use el componente puede fijar el membrete ella misma:
`<DocsEditor letterhead="/membrete.jpg" />`, con una dirección, un archivo o
sus bytes, y `null` para que no haya. El documento arranca con él sin que
cuente como cambio ni como paso que deshacer, el menú deja de ofrecer
cambiarlo, y si el documento ya trae esa misma imagen no se toca. Dando otra
después, se cambia. La imagen se estira a la
página entera: tiene que venir ya con su proporción. Se pone también en el
encabezado propio de la primera página, cuando lo tiene; lo demás que haya
en el encabezado se queda. Es un paso que se deshace, y con varias personas
en el documento lo ven todas.

Una imagen cuenta como membrete si está detrás del texto, se mide desde la
página y cubre al menos el 85 % de su ancho y de su alto; un logo en el
encabezado no lo es. No se puede seleccionar ni arrastrar: se cambia entero.

Comprobado: 5 tests del núcleo (ponerlo, escribirlo y leerlo, cambiarlo,
quitarlo, primera página, y qué no es membrete), uno de colaboración, y en
Chrome sin ventana sobre la demo y sobre un recibo real hecho en Word con
membrete: reconocerlo, cambiarlo, quitarlo, deshacer, guardar y volver a
abrir, y el PDF. Contra Word: el recibo original coincide en sus 11 líneas
a menos de 0,4 pt; el mismo recibo con el membrete cambiado aquí, también, y
la imagen cae en Word en las mismas filas de píxeles que en el editor; y un
documento de cuatro páginas con el membrete puesto aquí lo muestra en las
cuatro. El ajuste de márgenes, con el membrete del recibo: el de arriba pasa
de 72 a 79,25 pt y ninguna línea toca el logo ni el pie. La propiedad del
componente, en la aplicación de Next.js con Tailwind. El ajuste no mira los
márgenes de los lados, ni mueve el texto que ya haya en el encabezado.

Al exportar, las imágenes que ya nada muestra salen del archivo: el membrete
anterior al cambiarlo, o una imagen del texto que se borró. Un DOCX es un
archivo comprimido, y lo que se queda dentro lo ve quien lo desempaqueta.
Con los 18 documentos de prueba sin tocar, ninguno pierde una imagen.

### Pantallas angostas y táctiles

El documento no cambia de aspecto según la pantalla: sus hojas son las
mismas en un teléfono que en un monitor. La ventana es un sitio desde el que
se miran, más cerca o más lejos, como una mesa de trabajo. Lo que se adapta
es el zoom, los controles y la entrada.

**Ventana angosta.** `createResponsive(armazón, editor)` vigila el ancho del
elemento que contiene el editor y sus barras. Por debajo de 600 px le pone la
clase `dx-narrow`, ajusta las hojas al ancho de la ventana (una hoja carta
queda al 46 % en 390 px), quita la regla y saca el panel lateral encima del
documento, sin estrecharlo. El margen alrededor de las hojas baja de 24 a
8 px. A partir de ahí el zoom es de la persona: pellizca para acercarse y
desliza para moverse. Al ensanchar vuelve el zoom que había. `DocsEditor` lo
trae encendido (`features.responsive`), y el playground también.

Al pellizcar, lo que está bajo los dedos se queda bajo los dedos, y dos
dedos que se mueven juntos arrastran la hoja. Lo mismo con Ctrl o ⌘ y la
rueda: el zoom se hace sobre el puntero. Al escribir con la hoja acercada, el
cursor se mantiene a la vista también de lado.

**Vista fluida** (`editor.setView('flow')`, el primer botón de las vistas en
la barra de estado). Es opcional y nunca se pone sola: para quien prefiera
leer o escribir de corrido en un teléfono. El mismo documento maquetado al
ancho de la ventana, sin hojas, con el texto a su tamaño real:

- Son los mismos párrafos en las mismas posiciones: se edita igual, y el
  archivo que se exporta es idéntico al de la vista de página.
- Los saltos de página no parten nada; el encabezado, el pie y el membrete,
  que son de la hoja, no se muestran ni se editan ahí.
- Una tabla se estrecha hasta caber, sin bajar de 64 pt por columna. Si aun
  así no cabe, se queda más ancha que la pantalla y se llega a ella
  deslizando de lado; el texto de fuera sigue al ancho de la pantalla.
- Las imágenes más anchas que la pantalla se reducen, y las que flotaban en
  la hoja van en su línea. Su tamaño y su ajuste se cambian en la vista de
  página.
- Las sangrías grandes se acortan en proporción (los primeros 36 pt se
  respetan, para que las listas sigan viéndose como listas).
- El zoom cambia el tamaño del texto y lo vuelve a ajustar al ancho (del
  60 % al 300 %).
- Las páginas siguen existiendo: el contador de la barra de estado, el
  índice, imprimir y el PDF salen de ellas.

La maquetación la hace `layoutReflow(doc, measurer, { width, margin })` de
`@rebodocs/core`, que deriva un documento de una sola hoja sin fin
(`reflowDoc`) y lo pasa por el mismo motor.

La barra de herramientas y la de estado se pliegan solas; en una ventana
angosta el botón de la vista fluida es el único de las vistas que queda, y
pulsado otra vez vuelve a la hoja ajustada al ancho.

**Teclado en pantalla.** Un teléfono no acorta la ventana cuando sale el
teclado: lo dibuja encima. `keyboardInset(elemento)` dice cuántos píxeles
tapa, y `onKeyboard(fn)` avisa cuando cambia. El editor los usa para mantener
el cursor a la vista, y `createResponsive` deja ese hueco vacío al pie del
armazón, de modo que las barras y el documento quedan por encima del teclado.
El campo oculto tiene letra de 16 px para que iOS no acerque la página al
enfocarlo.

**Con el dedo:**

| Gesto | Qué hace |
| --- | --- |
| Un toque | Pone el cursor y saca el teclado. Bajo el cursor queda unos segundos un tirador para colocarlo con precisión. |
| Dos toques | Seleccionan la palabra; tres, el párrafo. |
| Mantener el dedo | Selecciona la palabra, y sin soltar se alarga la selección. |
| Tiradores | Uno en cada extremo de la selección; al arrastrarlos cerca del borde, el documento se desplaza. |
| Deslizar | Desplaza el documento sin mover el cursor. |
| Pellizcar | Acerca o aleja las hojas alrededor de los dedos; es el zoom del editor, no el de la página del navegador. |
| Dos dedos juntos | Arrastran la hoja. |

Al seleccionar con el dedo sale el globo de acciones, que entonces ofrece
además Copiar, Cortar, Pegar y Seleccionar todo, que es lo que el teclado
hace con teclas (`editor.copy()`, `cut()`, `paste()`; pegar puede hacer que
el navegador pida permiso, y solo se ofrece en una página servida por HTTPS
o en `localhost`, que es donde el navegador deja leer lo copiado). Con el ratón nada de esto aparece. Los botones de
las barras, los menús y el globo crecen a unos 38 px donde el puntero es un
dedo (`@media (pointer: coarse)`).

Sin la interfaz incluida, lo mismo se arma con `useDocsResponsive()`;
`state.zoom` y `state.view` dicen cómo se está viendo y `state.touch` si se
está usando el dedo.

Comprobado en Chrome sin ventana emulando un teléfono de 390 × 780 con
toques reales: las hojas ajustadas al ancho, pellizcar sobre una palabra (que
sigue bajo los dedos), arrastrar con dos dedos, el cursor a la vista de lado
al escribir, la vista fluida (texto y tabla de dos columnas dentro del
ancho, una de nueve columnas desplazable), toque, doble toque, mantener,
arrastrar un tirador, deslizar, una palabra compuesta letra a
letra y corregida por el teclado, Retroceso y Enter de teclado en pantalla,
el panel encima del documento, el recibo con membrete, y la vuelta a las
páginas al ensanchar. **No está probado en un teléfono real**: el teclado de
verdad (Gboard, iOS), la autocorrección y el hueco del teclado solo se
conocen por emulación.

### Idiomas

Todos los textos de la interfaz (barra, menú, paneles, diálogos, barra de
estado, regla, globo de acciones) salen de `i18n.ts` por su clave, en español
e inglés:

```ts
import { setLocale, addLocale, t, onLocaleChange } from '@rebodocs/editor';

setLocale(navigator.language);        // 'es', 'en', 'en-US'…; uno que no habla queda en inglés
addLocale('fr', { 'menu.save': 'Enregistrer' });  // otro idioma: lo que falte sale en inglés
t('status.page', { page: 2, pages: 9 });          // "Página 2 de 9"
```

**Añadir un idioma** son tres pasos, sin tocar el código del editor:

```sh
npm run locale -- fr textos/fr.json     # escribe los 342 textos, en inglés, para traducir
npm run locale -- fr textos/fr.json --from es   # o partiendo del español
```

Se traduce el archivo (es un JSON de clave y texto; lo que va entre llaves,
como `{page}`, se deja igual) y se le da al editor:

```tsx
import fr from './textos/fr.json';

addLocale('fr', fr); setLocale('fr');                  // sin React
<DocsEditor locales={{ fr }} locale="fr" … />           // con el componente
```

El idioma aparece solo en el selector del menú, con su nombre en su propio
idioma ("Français"; sale de `locale.name`, o del navegador si no se pone).
Cuando la interfaz gane textos, el mismo comando sobre el mismo archivo
conserva lo traducido, añade lo nuevo en inglés, quita lo que ya no existe y
dice cuánto queda por traducir. `messages('en')` da todos los textos de un
idioma desde código, y `addLocale('es', { … })` cambia palabras del español
o del inglés sin hacer un idioma nuevo.

Las piezas de la interfaz toman sus textos al crearse, así que para cambiar de
idioma con todo abierto se destruyen y se vuelven a crear (todas tienen
`destroy()`); el editor, el documento y el historial no se tocan. El playground
lo hace en `mount()`: `createSidebar` muestra el selector de idioma cuando se
le da `onLocale`, y la elección se guarda en `localStorage`. La primera vez se
usa el idioma del navegador.

El contenido del documento no se traduce. Lo que el editor *escribe* en él sí
sale en el idioma de la interfaz en el momento de insertarlo: "Page 1 of 3" en
el número de página, y ADVISER / CLIENT / FULL NAME en las firmas. Los estilos
estándar se muestran traducidos (Título 1 / Heading 1); los propios de un
documento conservan su nombre.

### Fuentes

El editor mide y pinta con las fuentes del navegador, así que cualquiera que
tenga la máquina funciona ya. Para las que no tiene (la tipografía de la
empresa, la de un membrete) está `addFont`:

```ts
import { addFont, addFonts } from '@rebodocs/editor';   // o desde '@rebodocs/react'

await addFonts([
  { family: 'Raleway', src: '/fonts/Raleway-Regular.ttf' },
  { family: 'Raleway', src: '/fonts/Raleway-Bold.ttf', bold: true },
  { family: 'Raleway', src: '/fonts/Raleway-Italic.ttf', italic: true },
]);
```

```tsx
<DocsEditor fonts={[{ family: 'Raleway', src: '/fonts/Raleway-Regular.ttf' }]} … />
```

Con eso la fuente:

- aparece en la lista de la barra de herramientas, arriba (en headless,
  `state.fonts`);
- se usa para medir y pintar: los documentos abiertos se vuelven a maquetar
  en cuanto carga, porque el ancho del texto cambia;
- va dentro de los PDF, recortada a las letras usadas, si el archivo es
  TrueType (`.ttf`).

`src` es una dirección o los bytes del archivo. Una familia se da cara por
cara (normal, negrita, cursiva); si falta una, el navegador la imita. Para
una fuente que la página ya carga por su cuenta, con CSS o `next/font`, basta
`addFont({ family: 'Raleway' })`: solo entra en la lista y se espera a que
cargue. Las fuentes son de la página entera, no de un documento, como las de
cualquier página web.

Límites: un `.woff2` o un `.otf` se ven y se miden, pero el PDF dibuja su
texto con una fuente estándar; para PDF hace falta el `.ttf`. La fuente no se
guarda dentro del DOCX: quien lo abra en Word sin tenerla instalada verá
otra en su lugar (las que el DOCX ya traía incrustadas sí se conservan). Y
en el servidor (`npm run generate`, MCP) las fuentes se dan aparte, con
`--fonts carpeta`.

### Buscar y reemplazar

`createFindBar(editor)` da un panel sobre la esquina del documento, que se
abre con ⌘F (o ⌘H, con la fila de reemplazar) o con el botón de la barra.
Marca todas las coincidencias, dice cuál es la seleccionada ("3 de 38"), va a
la siguiente o a la anterior (↵ y ⇧↵), distingue mayúsculas o busca solo
palabras completas si se le pide, y reemplaza una o todas; reemplazar todas es
un solo paso de deshacer. El texto nuevo toma el formato del que sustituye.
Busca en lo que se está editando: el documento, o el encabezado o el pie. Una
coincidencia no cruza de un párrafo a otro.

### Imágenes

El botón de imagen de la barra inserta un PNG, JPEG o GIF en el cursor
(también al pegar una imagen copiada), a su tamaño o al que quepa en la
página. La imagen es un carácter más del texto: se selecciona con un clic, y
entonces tiene un asa en cada esquina para cambiarle el tamaño sin deformarla,
y se arrastra a otro sitio del texto, donde el cursor marca dónde caerá. Las
que trae el archivo se redimensionan y se mueven igual. Al exportar, la imagen
se escribe en el paquete con su relación y su tipo.

### Regla

`createRuler(contenedor, editor)` pone sobre el documento la regla horizontal
de Word, alineada con la página del cursor a cualquier zoom y en cualquier
vista:

- la escala en centímetros, contados desde el borde izquierdo del texto, con
  la zona de texto en blanco y los márgenes en gris;
- los cuatro marcadores del párrafo del cursor: sangría de primera línea,
  sangría francesa (mueve el resto del párrafo y deja quieta la primera
  línea), sangría izquierda (mueve todo) y sangría derecha;
- los bordes de los márgenes izquierdo y derecho, que se arrastran desde justo
  fuera del texto.

Al arrastrar, una línea vertical marca dónde quedará el borde y el documento
cambia una sola vez, al soltar; Escape cancela. Los marcadores se ajustan a
cuartos de centímetro, salvo con Alt. Las sangrías se aplican a todos los
párrafos de la selección. Dentro de una tabla la regla mide desde el interior
de la celda.

### Barra de estado

`createStatusBar(contenedor, editor)` pone bajo el documento:

- a la izquierda, la página en la que está el cursor y el total, y las
  palabras y los caracteres del documento; con texto seleccionado, cuántos de
  ellos son de la selección ("12 de 2.949 palabras");
- a la derecha, la vista: el texto al ancho de la ventana y sin páginas, una
  página, dos páginas lado a lado o una cuadrícula con todas; ajustar al ancho de la ventana o ver la página
  completa (el zoom sigue entonces el tamaño de la ventana); y el zoom, con
  botones de alejar y acercar, un deslizador y el porcentaje, que al pulsarlo
  vuelve al 100 %.

El zoom también responde a Ctrl o ⌘ con la rueda y al pellizco del trackpad.
Va del 25 % al 400 %; el deslizador llega al 200 %. El zoom y la vista son del
editor (`setZoom`, `setFit`, `setView`), no del documento: no se guardan en el
archivo ni cambian la paginación.

Con menos ancho del que necesita, la barra de estado va quitando lo que
menos importa, en este orden: el deslizador, los caracteres, los ajustes de
página, las palabras, las notas al margen, las vistas y los botones de
zoom. La página, quién está en el documento, la vista fluida y el
porcentaje se quedan.
Probado de 1500 a 340 px.

## Qué está comprobado

- 128 tests del núcleo: XML, operaciones, layout, paginación, listas, tablas
  y sus celdas, número de página, edición de encabezados, estilos de párrafo,
  Markdown, buscar y reemplazar, imágenes, PDF, plantillas, formato al
  escribir, esquema, medición con archivos de fuente, PNG, caché de layout y
  DOCX.
- La barra de herramientas, en Chrome sin ventana y con clics reales: formato
  de caracteres y de párrafo, colores, interlineado, listas, la rejilla de
  tabla y el menú de filas y columnas, el menú de página sobre el contrato
  real (girar la hoja, A4, márgenes, salto de página), las opciones de
  paginación del párrafo, la sangría, el número de página (crearlo en un
  documento sin pie, moverlo, cambiarle el formato y quitarlo, y sustituir el
  que trae el contrato real, donde solo cambia la parte del pie), deshacer, cierre de menús con Escape y
  con clic fuera, y que tras todo ello lo que se escribe llega al documento. A
  640 px de ancho pasa a dos filas sin desbordarse. No tiene tests
  automáticos, ni se ha probado con teclado solo o con lector de pantalla.
- La barra de estado, igual: los contadores, con y sin selección; acercar,
  alejar, el deslizador, la rueda con Ctrl y volver al 100 %; los dos ajustes,
  que siguen a la ventana al estrecharla; las tres vistas, sobre el documento
  de ejemplo y sobre el contrato real; y que con zoom y a dos páginas el clic
  cae en el carácter pulsado, el cursor se dibuja sobre él y lo escrito llega
  al documento. No se ha probado en Firefox ni en Safari.
- La edición de encabezado y pie, igual: entrar con doble clic y desde el
  menú, escribir, partir el párrafo y alinearlo, que aparezca en todas las
  páginas, salir con Escape y con doble clic, que uno dejado vacío
  desaparezca, escribir junto al número de página, deshacer (que vuelve a
  entrar donde se hizo el cambio) y exportar y volver a abrir. En el contrato
  real, escribir en el pie junto a su número: cada página muestra el suyo, la
  paginación no cambia y en el archivo solo difiere la parte del pie. Word
  para Mac 16 abre las dos exportaciones sin avisos, con las mismas páginas
  (2 y 9), el encabezado y el pie escritos en cada una y el número de página
  recalculado ("Borrador 1" a "Borrador 9").
- Los estilos de párrafo, igual: aplicar un título y ver cambiar el tamaño en
  la barra, Enter al final de un título, una selección con estilos distintos
  (la lista queda en blanco), deshacer, usarlos en el encabezado, y exportar y
  volver a abrir. En el contrato real la lista ofrece sus propios títulos, y
  al aplicar uno solo cambia `document.xml`. Word para Mac 16 abre las dos
  exportaciones sin avisos, con las mismas páginas (3 y 9), y reconoce los
  párrafos como "Título", "Título 1" y "Normal".
- La regla, igual, con arrastres reales: los cuatro marcadores de sangría (que
  la francesa deje quieta la primera línea y la izquierda mueva ambas), el
  ajuste a cuartos de centímetro y Alt para no ajustar, Escape, los dos
  márgenes, deshacer, al 120 % y a dos páginas, dentro de una celda de tabla,
  y que sobre un elemento de lista del contrato real los marcadores caigan
  donde está su sangría.
- El menú del documento, igual: abrir y cerrar (botón, Escape), cada control
  de la página (A4, girar, un margen, uno fuera de rango, un preajuste, un
  ancho a mano) y deshacerlos, y las exportaciones a Word y Markdown, que
  llegan como descarga con su nombre y tipo. El PDF se sacó con la impresión
  de Chrome sin ventana: el del contrato real tiene 9 páginas tamaño carta,
  fuentes incrustadas y, página a página, el mismo texto que el PDF de Word.
  Guardar en el mismo archivo no se pudo probar ahí (necesita el selector de
  archivos del sistema); solo la descarga de reserva.
- Buscar y reemplazar, las celdas, las imágenes y el PDF directo, igual, con
  clics y arrastres reales: buscar con y sin mayúsculas, siguiente, reemplazar
  una y todas y deshacerlo; combinar celdas a lo ancho y a lo alto, dividir,
  sombrear, quitar bordes y arrastrar el borde de una columna; insertar una
  imagen, seleccionarla, cambiarle el tamaño por una esquina, arrastrarla a
  otro párrafo, y que todo ello vuelva al guardar y abrir el DOCX. El PDF
  directo del contrato real tiene 9 páginas, su fuente incrustada, el logo, y
  página a página el mismo texto que el PDF de Word; se miró además con el
  lector de macOS. El DOCX con tablas e imágenes cambiadas no se ha abierto
  en Word.
- Las utilidades propias, en Chrome sin ventana: los atajos al escribir (título,
  lista, negrita, cursiva, y que deshacer deje lo tecleado), el esquema (ir a
  un título y mover secciones arrastrando), y las variables (insertar desde
  una selección, escribirlas a mano, también en el pie, rellenar, deshacer).
  La generación desde la línea de comandos se probó con esa plantilla (DOCX,
  PDF y Markdown) y con el contrato real: su PDF, hecho en Node en menos de
  un segundo, tiene 9 páginas, las fuentes incrustadas, el logo, y página a
  página el mismo texto que el PDF de Word. Solo probado en macOS, con las
  fuentes del sistema.
- **Un contrato real de 9 páginas, contra Microsoft Word para Mac 16** (205
  párrafos, una tabla, 19 elementos de lista, cabecera con logo, pie con
  número de página y una fuente incrustada). Word lo exportó a PDF y se
  comparó con el layout del editor en Chrome:
  - las 9 páginas empiezan y acaban en el mismo texto;
  - 280 de 282 líneas (pie incluido) empiezan con el mismo texto a la misma
    altura, con una diferencia vertical máxima de 1,8 pt;
  - sin editar, el archivo exportado es idéntico al original parte por parte;
  - Word abre sin avisos una exportación con todos los párrafos reconstruidos
    y otra con ediciones en una lista, en la tabla y en el texto; ambas siguen
    en 9 páginas y las ediciones aparecen en su sitio.
- Siete DOCX reales (contratos de 9 páginas con tabla, entre otros):
  - sin editar, el archivo exportado es idéntico al original parte por parte;
  - forzando la reconstrucción de todos los párrafos, `pandoc` lee el mismo
    contenido y formato que en el original;
  - con ediciones, `pandoc` y `textutil` abren el resultado y solo cambia lo
    editado.
- En Chrome, con eventos reales de ratón y teclado: escribir, seleccionar,
  formato, deshacer y exportar. Un contrato de 9 páginas carga en ~150 ms y
  cada tecla cuesta ~10 ms (medido antes del caché de layout).
- En Chrome headless, un DOCX sintético con listas numeradas, de viñetas y
  multinivel: las etiquetas salen bien y el ancho pintado difiere del calculado
  en 0,02 px como máximo. En un documento de 53 páginas, escribir en la mitad
  cuesta ~2 ms por tecla; sin los cachés, ~42 ms.
- En Chrome headless, con teclas reales: crear una lista numerada y otra de
  viñetas, anidar con Tab, salir con Enter y quitar la etiqueta con Backspace.
  `pandoc` lee el archivo exportado con la misma estructura de niveles.
- En Chrome headless, un DOCX sintético con una tabla con bordes, celdas
  combinadas en vertical y en horizontal, una lista dentro de una celda y una
  tabla de firmas sin bordes: clic en una celda, Tab, escribir, flechas, Enter
  y Backspace. `pandoc` lee el archivo exportado con la misma tabla y los
  cambios hechos.

## Qué falta

  Sobre ese mismo contrato, en Chrome sin ventana y con clics y teclas reales:
  añadir una fila y una columna a su tabla, quitar la columna, Tab en la última
  celda, crear una tabla nueva en el texto y deshacer. `pandoc` lee la
  exportación con las filas añadidas y el resto del documento igual, y Word la
  abre sin avisos y dibuja las dos tablas. Word abre también un documento
  creado desde cero con una tabla reformada y una lista.

  Esa comparación se repite con `npm run word-compare -- archivo.docx`: usa
  el PDF que Word exportó la primera vez (`fixtures/`, fuera de git) y carga
  el documento en el playground con Chrome sin ventana. Con `--word` le pide
  a Word un PDF nuevo. Necesita macOS con Word, Chrome y `pdftotext`.
- **Teléfonos reales.** El zoom con los dedos, la entrada táctil y la vista
  fluida están comprobados emulando un teléfono en Chrome. Falta medir con
  Gboard y con el teclado de iOS. En la vista fluida no se mueven ni se redimensionan
  imágenes ni columnas, las tabulaciones a posiciones fijas pueden saltar de
  línea, y al escribir no se pone mayúscula sola al empezar una frase.
- **Fidelidad medida con un solo documento.** Las reglas de paginación y el
  límite de compresión de espacios salen de un contrato (Arial 11, carta,
  Word para Mac). Otros documentos, fuentes y versiones de Word pueden
  desviarse.
- **Tablas:** el ancho de las columnas se cambia arrastrando su borde, y se
  pueden combinar y dividir celdas, quitarles o ponerles los bordes y darles
  sombreado. No se cambia el alto de las filas, ni el borde izquierdo de la
  tabla. Dividir solo deshace una combinación: no parte una celda sencilla.
  Al quitar una columna la tabla se
  estrecha; al añadir una, las demás ceden sitio. Una tabla nueva es siempre
  de columnas iguales con borde fino. Si se cambia la forma de una tabla que
  tenía otra tabla dentro de una celda, la de dentro se escribe como párrafos
  sueltos, y no se actualizan las columnas vacías al inicio de una fila
  (`w:gridBefore`). Las filas de
  cabecera no se repiten al cambiar de página, y una fila partida no aplica
  control de viudas y huérfanas dentro de sus celdas. La partición de filas
  solo tiene tests sintéticos: el contrato real no tiene ninguna fila que
  cruce de página. Los bordes son todo o nada por celda, con un único
  grosor y color; el sombreado es un color liso (los tramados se ignoran) y no
  hay alineación vertical. Del estilo de tabla
  no se aplica el formato condicional (primera fila, bandas). El contenido de
  una celda combinada en vertical solo cuenta para la altura de su primera
  fila. Una tabla dentro de una celda se lee como párrafos de esa celda. El
  ancho de las columnas sale de la rejilla guardada en el archivo; no se
  recalcula según el contenido como hace Word. Solo probado con DOCX
  sintéticos.
- **Listas:** solo se cuentan los formatos decimal, letras y romanos (el resto
  sale en decimal). No se siguen `w:numStyleLink` ni las tabulaciones propias
  del nivel, y la etiqueta toma el formato del primer tramo del párrafo, no el
  de la marca de párrafo. Las listas nuevas son de dos tipos fijos (viñetas y
  números); no se puede reiniciar la numeración, elegir otro formato ni
  escribir `1. ` o `* ` para empezar una. Un párrafo sacado de una lista queda
  con sangría cero escrita de forma directa, y uno metido en una no cambia al
  estilo de lista. Solo probado con DOCX sintéticos.
- **Exportar:** en el PDF directo, un documento con fuentes que no sean
  Arial, Times New Roman o Courier New (ni vengan incrustadas) sale con la
  más parecida de esas tres: las líneas miden lo mismo, pero la letra no es
  la suya; para eso está "Imprimir…". Los caracteres fuera del alfabeto
  latino occidental salen como "?" con esas fuentes. No lleva enlaces ni
  marcadores, y las fuentes incrustadas van enteras, sin recortar. El Markdown no lleva
  imágenes ni enlaces, y el subrayado se pierde. No se importa Markdown ni
  PDF. Guardar en el mismo archivo solo existe en Chrome y Edge.
- **Asistentes (MCP):** un texto a buscar tiene que estar dentro de un
  párrafo. No hay notas en el encabezado ni el pie, porque Word no tiene
  comentarios ahí. A una tabla que el encabezado o el pie ya traían del
  archivo se le cambia el texto y el sombreado, pero no la forma (una tabla
  nueva sí se puede reformar). Una imagen se mueve a un párrafo propio, no a
  mitad de una línea. Entre equipos la conexión va sin cifrar.
- **Encabezado y pie:** se les pueden poner tablas, firmas e imágenes, desde
  la barra o por el asistente. A una tabla que ya traían del archivo no se
  le cambia la forma, y el ancho de las columnas no se arrastra ahí. Los
  archivos con tablas o imágenes en el encabezado no se han abierto en Word.
- **Enlaces:** un enlace no cruza de un párrafo a otro (cada párrafo lleva el
  suyo) y no se editan los enlaces a marcadores del propio documento, salvo
  los del índice. El archivo con enlaces no se ha abierto en Word: está
  comprobado contra la estructura que Word escribe, no con Word. Los enlaces
  del PDF se comprobaron en el archivo, no pulsándolos en un lector.
- **Plantillas:** las variables son solo texto que se sustituye: no hay
  condiciones ni repeticiones (una fila de tabla por cada elemento). Las
  fechas y los números se escriben solo a la manera de México (día/mes/año,
  1,234.56, $), y no hay importe en letras. Rellenar cambia el documento; no hay una vista previa
  que deje la plantilla intacta. En el editor solo se resaltan las de la
  parte que se está editando.
- **Generación sin navegador:** solo lee fuentes `.ttf` sueltas, no `.ttc`
  ni `.otf`; en un servidor sin las fuentes del documento hay que dárselas
  con `--fonts`, o el resultado pagina distinto. De los PNG lee los de 8 y
  16 bits; los GIF y los formatos vectoriales no salen en el PDF.
- **Esquema:** los títulos dentro de tablas no aparecen, y no se puede
  cambiar el nivel de una sección arrastrando.
- **Regla:** solo la horizontal; no hay regla vertical ni se arrastran los
  márgenes superior e inferior. No tiene tabuladores (el motor solo conoce
  los de cada 1,27 cm), ni cambia el ancho de las columnas de una tabla. Mide
  solo en centímetros. Con varias páginas a la vista sigue a la del cursor.
- **Estilos de párrafo:** se aplican, no se editan ni se crean. Cambiar de
  estilo pone a todo el párrafo el tamaño, la negrita, la cursiva y el color
  del estilo, también a las palabras que tenían los suyos. Del estilo solo se
  conoce lo que el modelo sabe leer: bordes, sombreado o numeración propios de
  un estilo llegan a Word por el nombre, pero aquí no se ven. Los nombres de
  los estilos estándar están solo en español, y no hay estilos de carácter.
- **Cabeceras y pies:** solo cuentan los "por defecto" de la última sección
  (no los de primera página ni pares/impares). En ellos no se pueden crear
  tablas ni cambiar la forma de las que haya (sí escribir en sus celdas), ni
  insertar o mover imágenes. Si al número de página se le añade texto en su
  misma línea, el panel de número de página deja de reconocerlo y pondría
  otro. El número no admite otros formatos (romanos, empezar en otro número)
  ni otro idioma que el español. La exportación con la página girada o con
  otros márgenes no se ha abierto en Word.
- **Notas al pie:** se conservan, no se muestran.
- **Imágenes:** el ajuste estrecho sigue la caja y no el contorno, y con dos
  imágenes en la misma línea el texto va por un solo lado. Una imagen sacada
  de su línea se queda donde estaba dibujada si su párrafo sigue en la misma
  página; si al cerrarse el hueco el párrafo cambia de página, queda junto a
  él. No se recortan ni giran. Contra Word se han comparado 15 archivos: tres
  versiones de un folleto de Google Docs y los doce de `float-cases`. En 13
  coinciden todas las líneas, y en los 15 todas las imágenes a 1 pt; en el de
  "encima y detrás" el texto se ve sobre la imagen de detrás y no sobre la de
  encima, igual que en Word. En los otros dos (`bordes` y `estrecho`) la
  diferencia es un salto de página junto a un párrafo con imagen, que Word
  pone una línea antes: no he dado con su regla. Los doce son archivos
  escritos por este motor; de otros programas solo está el folleto.
- **Primera página distinta:** en un documento de una sola página que la
  tenga, no hay dónde editar el encabezado de las demás. El número de página
  se pone en el de todas, no en el de la primera. No se leen los de páginas
  pares e impares.
- **Secciones:** solo se usa el tamaño de página de la última, y cambiar la
  página desde el editor cambia solo esa. Al girar la hoja los márgenes se
  quedan como estaban; Word los gira con ella. No se pueden poner márgenes ni
  tamaños a medida, solo los predefinidos. La exportación con la página
  cambiada no se ha abierto en Word.
- **Colaboración:** sin `--backend`, las salas no caducan ni se borran solas
  y no hay cuentas: quien tiene el enlace edita. Con él, el pase se comprueba
  al entrar y no otra vez: a quien se le quite el permiso sigue dentro hasta
  que se desconecte. No hay modo de solo lectura ni lista de salas. Dos listas creadas en el mismo instante pueden quedar con la
  misma definición. Si a alguien le cambian el documento mientras
  arrastra una imagen o el borde de una columna, el arrastre puede acabar en
  otro sitio. Un archivo abierto mientras se comparte no entra en la sala: se
  sale de ella. Con decenas de personas no se ha probado.
- **Rendimiento:** cada tecla vuelve a apilar todas las líneas y crea los
  elementos de todas las páginas al abrir. Para documentos de cientos de
  páginas hará falta pintar solo las páginas visibles.
- **Portapapeles:** solo texto plano.
- **Sin probar:** IME, móvil, y navegadores distintos de Chrome.
- El importador asume el prefijo `w:` en el XML, que es el que escriben Word y
  casi todos los generadores.
