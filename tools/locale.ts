// Starts a language for the interface, or brings one up to date:
//
//   npm run locale -- fr                 writes fr.json, every text in English, to translate
//   npm run locale -- fr texts/fr.json   the same, in another place
//   npm run locale -- fr --from es       starts from the Spanish texts and not the English
//
// Run again on a file that exists, it keeps what is translated, adds the
// texts the interface has gained since, in English, takes out the ones it no
// longer has, and says how many are still to translate. For a language with
// plural categories besides one and other, it adds a form of each text said
// of a number of things for each category (see PLURALS in i18n.ts). The file is what an
// application gives the editor: `addLocale('fr', texts)`, or the `locales`
// option of the component.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { type MessageKey, PLURALS, messages } from '../packages/editor/src/i18n';

const args = process.argv.slice(2).filter((arg) => arg !== '--');
const fromAt = args.indexOf('--from');
const from = fromAt >= 0 ? args.splice(fromAt, 2)[1] : 'en';
const [code, file = `${code}.json`] = args;
if (!code || code.startsWith('-')) {
  console.error('Usage: npm run locale -- <code> [file.json] [--from es]');
  process.exit(1);
}

const base = messages(from) as Record<string, string>;
const english = messages('en') as Record<string, string>;
const had: Record<string, string> = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};

// A language with plural categories besides one and other (Russian: one, few, many) says a text
// of a number of things in a form for each, "one" too: its one is not only 1, as 21 in Russian.
const categories = new Intl.PluralRules(code).resolvedOptions().pluralCategories.filter((category) => category !== 'other');
const forms = categories.some((category) => category !== 'one') ? categories : [];

const out: Record<string, string> = {};
/** What each text was started from, to tell the ones still to translate. */
const started: Record<string, string> = {};
let fresh = 0;
const put = (key: string, start: string) => {
  started[key] = start;
  if (key in had) out[key] = had[key];
  else {
    out[key] = start;
    fresh++;
  }
};
for (const key of Object.keys(english)) {
  put(key, base[key]);
  const one = PLURALS[key as MessageKey];
  if (one === undefined) continue;
  for (const category of forms) put(`${key}.${category}`, base[category === 'one' && one ? one : key]);
  // Forms written by hand for a language that needs none of its own are kept.
  for (const form of Object.keys(had)) if (form.startsWith(`${key}.`) && !(form in out)) out[form] = had[form];
}
// What a language calls itself is not a text to copy from another.
if (!('locale.name' in had)) {
  const name = new Intl.DisplayNames([code], { type: 'language' }).of(code) ?? code;
  out['locale.name'] = name.charAt(0).toLocaleUpperCase(code) + name.slice(1);
}
const gone = Object.keys(had).filter((key) => !(key in out));
const pending = Object.keys(out).filter((key) => key !== 'locale.name' && out[key] === started[key] && /\p{L}{3}/u.test(out[key]));

writeFileSync(file, `${JSON.stringify(out, null, 2)}\n`);
console.log(`${file}: ${Object.keys(out).length} texts${fresh ? `, ${fresh} new` : ''}${gone.length ? `, ${gone.length} taken out` : ''}.`);
console.log(pending.length ? `To translate (same as ${from === 'en' ? 'English' : `'${from}'`}): ${pending.length}.` : 'All translated.');
if (pending.length && pending.length <= 20) for (const key of pending) console.log(`  ${key}: ${out[key]}`);
