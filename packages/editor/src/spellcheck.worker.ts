// The worker of `createSpellChecker`: it holds the dictionaries, which take a
// moment and some memory to make ready, away from the page.
import nspell from 'nspell';

type Message =
  | { id: number; type: 'load'; key: string; aff: string; dic: string; fetch: boolean }
  | { id: number; type: 'check'; key: string; words: string[] }
  | { id: number; type: 'suggest'; key: string; word: string }
  | { id: number; type: 'add'; key: string; word: string };

const spellers = new Map<string, ReturnType<typeof nspell>>();

const read = async (url: string): Promise<string> => {
  const answer = await fetch(url);
  if (!answer.ok) throw new Error(`${url}: ${answer.status}`);
  return answer.text();
};

self.addEventListener('message', async (e: MessageEvent<Message>) => {
  const message = e.data;
  try {
    let result: unknown;
    if (message.type === 'load') {
      if (!spellers.has(message.key)) {
        const [aff, dic] = message.fetch ? await Promise.all([read(message.aff), read(message.dic)]) : [message.aff, message.dic];
        spellers.set(message.key, nspell(aff, dic));
      }
    } else {
      const speller = spellers.get(message.key);
      if (!speller) throw new Error(`No dictionary for ${message.key}`);
      if (message.type === 'check') result = message.words.map((word) => speller.correct(word));
      else if (message.type === 'suggest') result = speller.suggest(message.word);
      else speller.add(message.word);
    }
    if (message.id) self.postMessage({ id: message.id, result });
  } catch (error) {
    if (message.id) self.postMessage({ id: message.id, error: error instanceof Error ? error.message : String(error) });
  }
});
