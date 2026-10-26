### Párrafos por id, no por posición {#paragraphs-by-id-not-by-place}

Todos en una sala parten del mismo archivo, y `stampIds` le da a cada párrafo un id según dónde está en ese archivo: quien lea el mismo archivo obtiene los mismos ids, sin decirle nada a nadie. Un párrafo creado después recibe un id acuñado por el editor que lo creó (`<client>.<n>`), así que dos personas nunca pueden crear el mismo.

Un cambio nombra el párrafo del que trata por ese id. "En `k3`, en el offset 12, inserta `x`" sigue significando lo mismo después de que alguien añadió diez párrafos encima de `k3`, cosa que "en el párrafo 4" no haría.

Los encabezados, pies de página, notas al pie y cuadros de texto son *stories*, con párrafos e ids propios. Un cambio en uno lleva su `part` (`header`, `firstFooter`, el encabezado de una sección, `footnote:<id>`, `textbox:<id>`…), así que un cursor en un pie de página, o el texto escrito en un cuadro de texto, les llega a todos como el texto del cuerpo.

### Qué es un cambio {#what-a-change-is}

Un editor no envía teclas ni documentos. Cada vez que el documento cambia, lo compara con el último que envió (`diff`) y envía lo que es distinto, como una lista de operaciones:

| Operación | Qué dice |
| --- | --- |
| `splice` | En el párrafo `id`, en `at`, quita `remove` caracteres y pon estos runs, con su formato. Escribir, borrar, pegar y dar formato a parte de un párrafo son lo mismo. |
| `split`, `join` | Un párrafo cortado en dos en un lugar, con un id para la segunda mitad; dos párrafos hechos uno. |
| `insert`, `delete` | Párrafos enteros puestos después de otro (o al principio), o quitados. |
| `para` | El formato de un párrafo: solo lo que cambió de él, `null` para lo que se quitó. También la celda en que está y la sección que termina. |
| `table` | La forma de una tabla en conjunto: filas, columnas, anchos, celdas combinadas. |
| `story` | Un encabezado, pie de página, nota al pie o cuadro de texto creado, o quitado. |
| `set` | Algo del documento en conjunto: configuración de página, columnas, estilos, la primera página distinta, si se controlan los cambios. |
| `note`, `media`, `num` | Un comentario, los bytes de una imagen, una definición de lista. |

El formato es parte de los runs, y también lo es el [control de cambios](/es/docs/tracked-changes/): una eliminación que alguien hace con el control activado viaja como un `splice` que marca el texto como eliminado, y todos lo ven tachado, firmado con el nombre de esa persona.

El formato está en `@rebodocs/collab`, y nada de él necesita un navegador:

```ts
import { stampIds, ensureIds, diff, apply, transform } from '@rebodocs/collab';
import { importDocx } from '@rebodocs/core';

const before = stampIds(importDocx(file));
const after = ensureIds(before, editSomehow(before), mint);
const ops = diff(before, after);       // what turns one into the other
apply(before, ops);                     // the same document as `after`
```

### Un mismo orden para todos {#one-order-for-everybody}

El servidor guarda, para cada sala, el archivo del que partió y un registro de cada cambio desde entonces, numerado. Ese registro es el único orden que todos siguen.

Un editor envía sus cambios con el número del último que había visto (`rev`). Si otros llegaron entretanto, el servidor no lo rechaza: lo transforma (`transform`) contra esos, para que signifique lo que quiso su autor sobre el documento tal como está ahora, lo añade al registro y se lo dice a todos. Cada editor aplica los cambios del registro en orden, y así todos terminan con el mismo documento.

Un editor envía un lote a la vez y espera a que ocupe su lugar; lo que se escribe mientras tanto se junta para el siguiente. Cada lote tiene un número de secuencia, así que uno reenviado porque se perdió su respuesta se toma una sola vez.

### La comprobación contra la sala {#the-check-against-the-room}

Las reglas no son todo. **El servidor comprueba que todos tengan su documento**: un momento después de que paran los cambios (1,5 s, o cada 6 s mientras siguen), le dice a la sala, en dieciséis letras, cómo es su documento: un resumen del texto, párrafo por párrafo, con su formato y la forma de sus tablas. Cada editor hace el mismo resumen del documento que tiene de la sala, y si no es igual, vuelve a cargar la sala: su archivo y cada cambio que se le hizo. Lo que la persona había escrito y la sala aún no tenía se vuelve a hacer sobre ella y se envía, así que no se pierde nada de lo que escribió; lo que puede deshacer empieza de nuevo. Así, lo que las reglas hagan mal dura un par de segundos, no hasta que alguien vuelva a abrir el documento. `session.resyncs` dice cuántas veces pasó, y la consola lo dice cada vez.

Una eliminación lleva el párrafo que quita, Intro el formato del párrafo nuevo, y el formato dice que es formato: los editores más viejos envían cambios sin eso, y sus cambios se toman como antes. Clientes de versiones distintas en la misma sala pueden terminar con formato distinto, y un editor de antes no compara su documento con el del servidor, así que actualiza los editores y el servidor juntos.

### Qué hace el editor con todo esto {#what-the-editor-does-with-it}

- **Lo que hace la persona se muestra en el acto.** El editor no espera al servidor. Cuando llega primero un cambio de otra persona, se aplica sobre el documento que confirmó el servidor, y lo que esta persona aún no tiene confirmado se transforma contra él y se vuelve a aplicar encima.
- **Deshacer es por persona.** Cada paso se guarda como los cambios que lo deshacen, no como el documento tal como estaba. Cuando llegan cambios de otros, los pasos guardados se transforman también contra ellos, así que deshacer quita lo que hiciste tú y deja lo que hicieron ellos después.
- **Los cursores son lugares por id.** Dónde está cada persona viaja como un id de párrafo y un offset, con la parte y la página, unos 40 ms después de que se mueve. Cuando llegan cambios, los cursores de los demás se llevan a través de ellos.
- **Comprobado contra la sala.** El editor compara su documento con el resumen que el servidor envía de vez en cuando, y vuelve a cargar la sala cuando difieren (ver arriba).
- **Reconexión.** Si se corta la conexión, el editor sigue funcionando (`state` es `'offline'`) y lo intenta de nuevo tras 0,5 s, luego 1, 2, 4, hasta 8 s. Al volver, dice hasta dónde había llegado; el servidor envía solo lo que se perdió, y lo que había enviado sin respuesta se envía de nuevo. Si la sala se plegó en su archivo entretanto (ver abajo), o se soltó y se volvió a leer de tu backend, vuelve a cargar la sala desde el principio, y lo escrito mientras estaba fuera no se pierde: reconoce qué párrafos del archivo son los que tenía por lo que dicen, toma lo que hicieron los demás entretanto como el cambio de uno al otro, y aplica lo escrito después, como si ambos hubieran escrito a la vez. Lo que el servidor había dicho que tomó ya está en el archivo y no se aplica dos veces; lo que se puede deshacer empieza de nuevo. Una sala que no existe (404), una persona a la que ya no se deja entrar (403), o una que el servidor expulsó (`removed`) terminan la sesión.
- **Su propia clave.** Al entrar, el editor recibe una clave que solo él conoce, y todo lo que envía la lleva. Los demás conocen su id, para dibujar su cursor, pero no pueden enviar como él: alguien que solo entró a mirar no puede hacer pasar sus cambios por los de un editor.

### La vida de una sala {#the-life-of-a-room}

1. **Se abre** cuando alguien entra y no hay nadie: el servidor le pide el archivo al almacenamiento (con un backend, `GET /docs/<id>`).
2. **Mientras hay gente**, cada cambio va a su registro en memoria, y el servidor le da al backend el documento tal como está (`PUT`) `saveAfter` después de que paran los cambios (5 s por defecto), y al menos cada `saveEvery` (30 s) mientras siguen. Cuando el registro tiene `foldAfter` cambios (1000), el servidor los pliega en el archivo en la siguiente pausa, con todos aún dentro: quien entra entonces tiene el archivo y pocos cambios que aplicar, no los de todo el día.
3. **Cuando sale el último**, el servidor espera `idle` (30 s por defecto), junta los cambios en un archivo, lo guarda y suelta la sala. Ese `PUT` dice que la sesión terminó, y quién cambió el documento en ella: [una versión por cada sesión](#a-version-for-each-session). Alguien que vuelve entretanto la encuentra como estaba.
4. **Al apagarse** (`SIGINT`, `SIGTERM`) el comando le da al backend lo que aún no tiene antes de salir. En un programa propio, llama a `server.flush()`.

Cada vez que los cambios se pliegan en el archivo, el `epoch` de la sala sube: un cliente que tenía la sala antes de plegarse sabe que sus números ya no valen, y la vuelve a cargar. Si se pliega con gente dentro, el archivo leído de nuevo les da a algunos párrafos otros ids de los que tenían; el servidor les dice a los editores cuáles (`fold`), y cada uno carga el archivo nuevo y aplica sobre él lo que no había enviado, con lo que puede deshacer, con los ids nuevos. El servidor solo pliega cuando el archivo se lee de vuelta como el documento del que se escribió; si no, los cambios esperan a que la sala se vacíe, como antes.
