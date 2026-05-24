const fs = require('fs');
const path = require('path');

const SUPPORTED = ['en', 'tr', 'fr'];
const DEFAULT = 'en';

const locales = Object.fromEntries(
  SUPPORTED.map((l) => [
    l,
    JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'locales', `${l}.json`), 'utf8')),
  ])
);

const FRANCOPHONE = new Set([
  'FR', 'BE', 'CH', 'LU', 'MC',
  'SN', 'CI', 'ML', 'BF', 'NE', 'TG', 'BJ', 'GA', 'CG', 'CD', 'CM', 'MG', 'CF',
  'TD', 'DJ', 'KM', 'GN', 'GQ', 'BI', 'RW', 'SC', 'VU', 'HT',
]);

function localeFromCountry(cc) {
  if (!cc) return DEFAULT;
  const up = cc.toUpperCase();
  if (up === 'TR') return 'tr';
  if (FRANCOPHONE.has(up)) return 'fr';
  return 'en';
}

function localeFromAcceptLanguage(header) {
  if (!header) return null;
  const tags = header
    .split(',')
    .map((part) => {
      const [tag, q] = part.trim().split(';q=');
      return { tag: tag.toLowerCase(), q: q ? parseFloat(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);
  for (const { tag } of tags) {
    const base = tag.split('-')[0];
    if (SUPPORTED.includes(base)) return base;
  }
  return null;
}

function detectLocale(req) {
  const cookieLang = req.headers.cookie?.match(/(?:^|;\s*)lang=([a-z]{2})/i)?.[1];
  if (cookieLang && SUPPORTED.includes(cookieLang)) return cookieLang;

  const cf = req.headers['cf-ipcountry'];
  const xc = req.headers['x-country-code'];
  const cc = (cf || xc || '').toString().toUpperCase();
  if (cc && cc !== 'XX' && cc !== 'T1') return localeFromCountry(cc);

  const al = localeFromAcceptLanguage(req.headers['accept-language']);
  if (al) return al;
  return DEFAULT;
}

function t(locale, key) {
  const dict = locales[locale] || locales[DEFAULT];
  return key.split('.').reduce((acc, k) => (acc && acc[k] !== undefined ? acc[k] : null), dict) ?? key;
}

function relativeTime(locale, isoDate) {
  const dict = locales[locale] || locales[DEFAULT];
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return dict.time.just_now;
  if (min < 60) return dict.time.minutes_ago.replace('{n}', min);
  const hr = Math.floor(min / 60);
  if (hr < 24) return dict.time.hours_ago.replace('{n}', hr);
  const d = Math.floor(hr / 24);
  return dict.time.days_ago.replace('{n}', d);
}

module.exports = { SUPPORTED, DEFAULT, locales, detectLocale, localeFromCountry, t, relativeTime };
