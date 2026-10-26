### 在你自己的程序中运行服务器 {#the-server-in-a-program-of-your-own}

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

存储是一个接口，基于 HTTP 的后端只是自带的三种之一，你也可以自己编写（例如直接写入数据库）：

| 存储 | 保存的内容 |
| --- | --- |
| `backendStorage({ url, key })` | 什么也不保存：文档属于你的后端，由它决定谁能进入。 |
| `folderStorage(dir)` | 每个房间一个文件夹：`base.docx`、记录每次更改的 `log.jsonl`、`meta.json`。上次合并之前的文件和日志以 `*.before.*` 的形式保留在旁边。 |
| `memoryStorage()` | 完全不保存：房间随进程存在。 |

`recheck` 会用每个人进入时的票据再次询问 `/access`：不再被允许的人会被移出，现在只能查看或可以编辑的人会以新的身份重新进入。过期的票据会按原样询问，所以请让票据的有效期覆盖一次会话的时长，或者省略 `recheckEvery`，在你的系统收回某人的权限时调用 `recheck`。提供 `onEvent` 时，出错信息会交给它，而不是输出到控制台。

`RoomStorage` 有用于文件的 `load(id)` 和 `keep(id, room, folded)`、用于每次更改的 `add(id, entry)`，以及可选的 `save(id, docx)`（在大家工作时保存文档）和 `admit(id, ticket)`（决定谁能进入、用什么名字、是否只能查看：`{ name, readOnly: true }`）。只被允许查看的人能看到别人输入，但不能修改任何内容：编辑器变为只读，服务器也会拒绝其更改。`/access` 用 `"readOnly": true` 表达同样的意思。

### 嵌入你的 API，使用它的端口 {#inside-your-api-on-its-port}

不提供 `port` 时，服务器不监听任何端口：把它的 `handle` 挂载到你的 API 已有的服务器上，房间存储就可以直接调用你的服务，无需那三个路由：

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

它从 `originalUrl` 读取地址，所以 Express 去掉的前缀无关紧要，并且接受你的 body parser 已经读取的请求体。它的路由以 `Access-Control-Allow-Origin: *` 响应，不需要 cookie：票据才是进入的凭证。每个房间仍由一个进程持有，因此请只运行一个 API 实例，或把每个房间路由到同一个实例。

### 通信协议 {#on-the-wire}

所有内容都在 `/collab` 下，使用普通 HTTP：每人一条 [server-sent events](https://developer.mozilla.org/docs/Web/API/Server-sent_events) 流，用 POST 发送。任何能通过 HTTP 的代理都能通过它；请为事件路由关闭响应缓冲（服务器已经为 nginx 发送 `X-Accel-Buffering: no`）。

| 路由 | 用途 |
| --- | --- |
| `GET  /collab/ping` | 是否有协作服务器响应、它使用的协议版本（`collab`）、创建房间是否需要令牌，以及它的 `instance`（如有）。 |
| `POST /collab/rooms` | 用一份文档创建房间（仅限没有后端时）。 |
| `POST /collab/rooms/<id>/recheck`、`/collab/recheck` | 再次向后端询问谁可以进入该房间或所有房间；使用 `recheckKey` 时以 `Authorization: Bearer …` 提供。 |
| `GET  /collab/rooms/<id>/events` | 带上 `v`，即编辑器使用的协议版本：服务器不支持的版本会得到 426，并附上它支持的版本。事件流：`hello`（房间、客户端缺少的更改、在场的人以及客户端的 `key`），然后是 `op`、`presence`、`leave`、`check`（某个修订版本的文档摘要）、`fold`（合并进文件的更改以及段落的新 id）和 `removed`。每 20 秒发送一条注释以保持连接。 |
| `POST /collab/rooms/<id>/ops` | 一批更改，附带 `client`、`key`、`rev`、`epoch` 和 `seq`。 |
| `POST /collab/rooms/<id>/presence` | 此人光标的位置，附带 `client` 和 `key`；最多 64 KB。 |
| `GET  /collab/rooms/<id>/base`、`/docx` | 房间的起始文件；当前的文档。仅限房间中的人（`client` 和 `key`），且有后端时。 |

每人一次可以发送 200 个请求，之后每秒 50 个，远多于编辑器的实际用量；超出时服务器返回 429，编辑器会重试。

### 不使用 React {#without-react}

带 `collab` 的 `DocsEditor` 会完成这一切。只使用编辑器时，`joinRoom` 接受任何 `Editor`；当它的 `state` 变为 `'closed'` 时，`reason` 会说明原因：`'left'`、`'not-found'`、`'denied'`、`'removed'`（被移出）或 `'outdated'`（编辑器和服务器使用的协议版本 `PROTOCOL` 不同）：

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

`createRoom(url, docx, name, token?)` 用用户自己的文档创建房间（没有后端时），`pingServer(url)` 判断服务器是否存在。

### 不用后端试用 {#trying-it-without-a-backend}

```bash
npx @rebodocs/collab                 # keeps rooms in ./rooms
npx @rebodocs/collab --memory        # keeps nothing
```

在 playground 中，状态栏的“共享”按钮会创建一个房间，并给出可以分享的链接。
