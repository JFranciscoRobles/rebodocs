### El servidor en un programa propio {#the-server-in-a-program-of-your-own}

```ts
import { createCollabServer } from '@rebodocs/collab/server';
import { backendStorage } from '@rebodocs/collab/storage';

const server = createCollabServer({
  port: 7420,
  host: '0.0.0.0',
  storage: backendStorage({ url: 'https://api.example.com/docs', key: process.env.KEY, log: true }), // log: every change as it comes
  saveAfter: 5_000,    // ms after the last change the document is given to the backend
  saveEvery: 30_000,   // and at least this often while people type
  idle: 5_000,         // ms a room nobody is in waits before it is saved and let go of
  checkAfter: 1_500,   // ms after the last change the room is told what its document is like
  foldAfter: 1_000,    // changes a room gathers before they are folded into its file, with people in it
  recheckEvery: 300_000, // ms between asking the backend again who may be in; never when left out
  recheckKey: process.env.KEY, // what the backend shows to POST /collab/rooms/<id>/recheck
  instance: 'collab-1', // this process, among several: in X-Rebodocs-Instance
  onEvent: (event) => log(event), // join, leave, fold, save, removed, error
});
await server.ready;

server.rooms();        // [{ id, people: ['Ana', 'Luis'] }]: who is where, for a list of open documents
await server.recheck(documentId);   // someone's access changed: ask now, not at the next recheckEvery
process.on('SIGTERM', () => void server.flush().finally(() => server.close()));
```

El almacenamiento es una interfaz, así que el backend por HTTP es uno de los tres que vienen, y puedes escribir el tuyo (directo a una base de datos, por ejemplo):

| Almacenamiento | Qué guarda |
| --- | --- |
| `backendStorage({ url, key })` | Nada: los documentos son de tu backend, y él dice quién entra. |
| `folderStorage(dir)` | Cada sala en una carpeta: `base.docx`, `log.jsonl` con cada cambio, `meta.json`. El archivo y el registro anteriores al último pliegue se quedan al lado, como `*.before.*`. |
| `memoryStorage()` | Nada en absoluto: las salas duran lo que dura el proceso. |

`recheck` vuelve a preguntar a `/access` con el ticket con que entró cada persona: a quien ya no deja entrar lo expulsa, y quien ahora solo puede mirar, o editar, vuelve como tal. Los tickets que caducan se preguntan tal cual, así que hazlos durar lo que pueda durar una sesión, u omite `recheckEvery` y llama a `recheck` cuando tu sistema le quite el acceso a alguien. Si se da `onEvent`, lo que sale mal va a él en lugar de a la consola.

Un `RoomStorage` tiene `load(id)` y `keep(id, room, folded)` para el archivo, `add(id, entry)` para cada cambio, y opcionalmente `save(id, docx)` para el documento mientras la gente trabaja, y `admit(id, ticket)` para decir quién puede entrar, con qué nombre, y si solo para mirar (`{ name, readOnly: true }`). Alguien que entró a mirar ve escribir a los demás y no puede cambiar nada: el editor queda de solo lectura, y el servidor rechaza sus cambios. `/access` lo dice igual, con `"readOnly": true`.

### Dentro de tu API, en su puerto {#inside-your-api-on-its-port}

Sin `port`, el servidor no escucha en ninguno: monta su `handle` en el servidor que tu API ya tiene, y el almacenamiento de salas puede llamar a tus servicios directamente, sin las tres rutas:

```ts
const collab = createCollabServer({
  storage: {
    open: false,
    forgets: true,
    // A new epoch each time: an editor that had the room before it was let go of knows the file may have changed.
    load: async (id) => ({ name: await documents.name(id), epoch: Date.now(), base: await documents.read(id), log: [] }),
    keep: async (id, room, folded, ended) => { if (folded) await documents.write(id, room.base, ended?.authors); },
    add: () => {},
    save: (id, docx) => documents.write(id, docx),
    admit: (id, ticket) => tickets.check(id, ticket),   // { name, readOnly? } or undefined
  },
  saveEvery: 10_000,
});

app.use('/collab', collab.handle);   // Express; in Nest, app.use in main.ts
```

Lee la dirección de `originalUrl`, así que el prefijo que quita Express no importa, y acepta un cuerpo que tu body parser ya leyó. Sus rutas responden con `Access-Control-Allow-Origin: *` y no necesitan cookies: el ticket es lo que deja entrar a alguien. Un solo proceso sigue llevando cada sala, así que ejecuta una instancia de la API, o enruta cada sala a una.

### En la red {#on-the-wire}

Todo está bajo `/collab`, como HTTP simple: un flujo de [server-sent events](https://developer.mozilla.org/docs/Web/API/Server-sent_events) por persona, y POST para enviar. Cualquier proxy que deja pasar HTTP lo deja pasar; desactiva el buffering de respuestas para la ruta de eventos (el servidor ya envía `X-Accel-Buffering: no` para nginx).

| Ruta | Qué es |
| --- | --- |
| `GET  /collab/ping` | Si responde un servidor de colaboración, la versión del protocolo que habla (`collab`), si empezar una sala necesita un token, y su `instance` cuando tiene. |
| `POST /collab/rooms` | Empieza una sala con un documento (solo sin backend). |
| `POST /collab/rooms/<id>/recheck`, `/collab/recheck` | Vuelve a preguntar al backend quién puede estar en esa sala, o en todas; con `recheckKey`, como `Authorization: Bearer …`. |
| `GET  /collab/rooms/<id>/events` | Con `v`, la versión del protocolo que habla el editor: a una que este servidor no habla se responde 426, con la que sí habla. El flujo: `hello` (la sala, los cambios que le faltan al cliente, quién está, y la `key` del cliente), luego `op`, `presence`, `leave`, `check` (el resumen del documento en una revisión), `fold` (los cambios plegados en el archivo, y los ids nuevos de los párrafos) y `removed`. Un comentario cada 20 s lo mantiene abierto. |
| `POST /collab/rooms/<id>/ops` | Un lote de cambios, con `client`, `key`, `rev`, `epoch` y `seq`. |
| `POST /collab/rooms/<id>/presence` | Dónde está el cursor de esta persona, con `client` y `key`; 64 KB como mucho. |
| `GET  /collab/rooms/<id>/base`, `/docx` | El archivo del que partió la sala; el documento tal como está ahora. Solo para alguien en la sala (`client` y `key`), cuando hay backend. |

Cada persona puede enviar 200 de una vez y 50 más por segundo, mucho más de lo que hace un editor; pasado eso el servidor responde 429 y el editor lo intenta de nuevo.

### Sin React {#without-react}

`DocsEditor` con `collab` hace todo esto. Con el editor solo, `joinRoom` toma cualquier `Editor`; cuando su `state` es `'closed'`, su `reason` dice por qué: `'left'`, `'not-found'`, `'denied'`, `'removed'` (expulsado) o `'outdated'` (el editor y el servidor hablan versiones distintas, `PROTOCOL`):

```ts
import { Editor } from '@rebodocs/editor';
import { joinRoom } from '@rebodocs/collab/browser';

const editor = new Editor(element);
const session = joinRoom(editor, documentId, {
  url: 'https://collab.example.com',
  ticket,
  onChange: () => render(session.state, session.peers),
});

session.pending;     // changes made here the server has not taken yet: worth checking before closing the page
session.resyncs;     // times the document here was found not to be the room's, and loaded again
session.leave();     // stops sharing; the document stays as it is
```

`createRoom(url, docx, name, token?)` empieza una sala con un documento propio de la persona (sin backend), y `pingServer(url)` dice si hay un servidor.

### Probarlo sin backend {#trying-it-without-a-backend}

```bash
npx @rebodocs/collab                 # keeps rooms in ./rooms
npx @rebodocs/collab --memory        # keeps nothing
```

En el playground, el botón "Compartir" de la barra de estado empieza una sala y da un enlace para pasar.
