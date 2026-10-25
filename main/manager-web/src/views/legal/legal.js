// Pure helpers of the legal pages (terms of use, privacy policy). No Vue: unit tested in
// tests/legal.test.mjs. The texts themselves are generated into ./texts.js from docs/legal/*.md.
import { LEGAL_TEXTS } from './texts.js';

// TODO(Nobix): fill in Nobix Industries' support email and/or phone number here, e.g.
// 'support@example.com, 01XXXXXXXXX'. While it is empty, the closing "contact us" sentence of each
// document ends without the ": {{CONTACT}}" part instead of showing a placeholder.
export const LEGAL_CONTACT = '';

export const LEGAL_DOCS = ['terms', 'privacy'];

// The document in the reading language: Bangla for 'bn', English for everything else.
export function legalDoc(name, lang) {
  const doc = LEGAL_TEXTS[name] || LEGAL_TEXTS.terms;
  return String(lang || '') === 'bn' ? doc.bn : doc.en;
}

// Puts the contact into a sentence, or drops ": {{CONTACT}}" when there is none yet, so the
// sentence ends on its own full stop ('।' in Bangla, '.' in English).
export function withContact(text, contact = LEGAL_CONTACT) {
  const s = String(text ?? '');
  const c = String(contact || '').trim();
  if (c) return s.split('{{CONTACT}}').join(c);
  return s.replace(/\s*:\s*\{\{CONTACT\}\}/g, '').split('{{CONTACT}}').join('');
}
