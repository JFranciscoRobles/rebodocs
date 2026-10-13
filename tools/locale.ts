// Starts a language for the interface, or brings one up to date:
//
//   npm run locale -- fr                 writes fr.json, every text in English, to translate
//   npm run locale -- fr textos/fr.json  the same, in another place
//   npm run locale -- fr --from es       starts from the Spanish texts and not the English
//
// Run again on a file that exists, it keeps what is translated, adds the
// texts the interface has gained since, in English, takes out the ones it no
// longer has, and says how many are still to translate. The file is what an
// application gives the editor: `addLocale('fr', texts)`, or the `locales`
// option of the component.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { messages } from '../packages/editor/src/i18n';

const args = process.argv.slice(2).filter((arg) => arg !== '--');
const fromAt = args.indexOf('--from');
const from = fromAt >= 0 ? args.splice(fromAt, 2)[1] : 'en';
const [code, file = `${code}.json`] = args;
if (!code || code.startsWith('-')) {
  console.error('Uso: npm run locale -- <código> [archivo.json] [--from es]');
  process.exit(1);
}

const base = messages(from) as Record<string, string>;
const english = messages('en') as Record<string, string>;
const had: Record<string, string> = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};

const out: Record<string, string> = {};
let fresh = 0;
for (const key of Object.keys(english)) {
  if (key in had) out[key] = had[key];
  else {
    out[key] = base[key];
    fresh++;
  }
}
// What a language calls itself is not a text to copy from another.
if (!('locale.name' in had)) {
  const name = new Intl.DisplayNames([code], { type: 'language' }).of(code) ?? code;
  out['locale.name'] = name.charAt(0).toLocaleUpperCase(code) + name.slice(1);
}
const gone = Object.keys(had).filter((key) => !(key in english));
const pending = Object.keys(out).filter((key) => key !== 'locale.name' && out[key] === base[key] && /\p{L}{3}/u.test(out[key]));

writeFileSync(file, `${JSON.stringify(out, null, 2)}\n`);
console.log(`${file}: ${Object.keys(out).length} textos${fresh ? `, ${fresh} nuevos` : ''}${gone.length ? `, ${gone.length} quitados` : ''}.`);
console.log(pending.length ? `Por traducir (iguales al ${from === 'en' ? 'inglés' : from}): ${pending.length}.` : 'Todo traducido.');
if (pending.length && pending.length <= 20) for (const key of pending) console.log(`  ${key}: ${out[key]}`);
