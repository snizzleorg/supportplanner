/**
 * Country Aliases Utility
 * 
 * Combines ISO 3166-1 country name translations with informal aliases
 * for comprehensive location search matching.
 * 
 * @module country-aliases
 */

import countries from 'i18n-iso-countries';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Register language locales for translations
countries.registerLocale(require('i18n-iso-countries/langs/en.json'));
countries.registerLocale(require('i18n-iso-countries/langs/de.json'));
countries.registerLocale(require('i18n-iso-countries/langs/fr.json'));
countries.registerLocale(require('i18n-iso-countries/langs/es.json'));
countries.registerLocale(require('i18n-iso-countries/langs/it.json'));
countries.registerLocale(require('i18n-iso-countries/langs/pt.json'));
countries.registerLocale(require('i18n-iso-countries/langs/nl.json'));
countries.registerLocale(require('i18n-iso-countries/langs/pl.json'));
countries.registerLocale(require('i18n-iso-countries/langs/ru.json'));
countries.registerLocale(require('i18n-iso-countries/langs/ja.json'));
countries.registerLocale(require('i18n-iso-countries/langs/zh.json'));
countries.registerLocale(require('i18n-iso-countries/langs/ko.json'));

// Languages to include in alias generation
const LANGUAGES = ['en', 'de', 'fr', 'es', 'it', 'pt', 'nl', 'pl', 'ru', 'ja', 'zh', 'ko'];

/**
 * Manual informal aliases not covered by ISO standards
 * These include common abbreviations, constituent countries, and colloquial names
 */
const INFORMAL_ALIASES = {
  // UK constituents and colloquial names
  'GB': ['uk', 'great britain', 'großbritannien', 'england', 'scotland', 'wales', 'northern ireland', 'britain'],
  // USA colloquial names
  'US': ['usa', 'america', 'amerika', 'the states', 'vereinigte staaten'],
  // Netherlands colloquial
  'NL': ['holland'],
  // UAE
  'AE': ['uae', 'emirates', 'emirate'],
  // Czech Republic
  'CZ': ['czechia', 'tschechien'],
  // South Korea
  'KR': ['korea', 'südkorea', 'south korea'],
  // Russia
  'RU': ['russland'],
  // China
  'CN': ['prc', 'volksrepublik china'],
  // Taiwan
  'TW': ['roc', 'republic of china', 'formosa'],
  // Hong Kong
  'HK': ['hongkong'],
  // Switzerland
  'CH': ['schweiz', 'suisse', 'svizzera'],
  // Belgium
  'BE': ['belgien', 'belgique', 'belgië'],
  // Austria
  'AT': ['österreich', 'oesterreich'],
  // Brazil
  'BR': ['brasil', 'brasilien'],
  // Mexico
  'MX': ['mexiko'],
  // South Africa
  'ZA': ['südafrika', 'suedafrika', 'rsa'],
  // New Zealand
  'NZ': ['neuseeland', 'aotearoa'],
  // Singapore
  'SG': ['singapur'],
  // India
  'IN': ['indien', 'bharat'],
  // Egypt
  'EG': ['ägypten', 'aegypten'],
  // Morocco
  'MA': ['marokko'],
  // Kenya
  'KE': ['kenia'],
  // Saudi Arabia
  'SA': ['saudi-arabien', 'saudiarabien'],
  // Canada
  'CA': ['kanada'],
  // Australia
  'AU': ['australien'],
  // Argentina
  'AR': ['argentinien'],
  // Colombia
  'CO': ['kolumbien'],
  // Indonesia
  'ID': ['indonesien'],
  // Philippines
  'PH': ['philippinen', 'pilipinas'],
  // Greece
  'GR': ['griechenland', 'hellas', 'ελλάδα'],
  // Hungary
  'HU': ['ungarn', 'magyarország'],
  // Romania
  'RO': ['rumänien', 'rumaenien'],
  // Bulgaria
  'BG': ['bulgarien'],
  // Croatia
  'HR': ['kroatien', 'hrvatska'],
  // Serbia
  'RS': ['serbien'],
  // Ukraine
  'UA': ['україна'],
  // Turkey
  'TR': ['türkei', 'tuerkei', 'türkiye'],
  // Denmark
  'DK': ['dänemark', 'daenemark', 'danmark'],
  // Sweden
  'SE': ['schweden', 'sverige'],
  // Norway
  'NO': ['norwegen', 'norge'],
  // Finland
  'FI': ['finnland', 'suomi'],
  // Poland
  'PL': ['polen', 'polska'],
  // Ireland
  'IE': ['irland', 'éire', 'eire'],
  // Portugal
  'PT': ['portugal'],
  // Slovakia
  'SK': ['slowakei', 'slovensko'],
  // Slovenia
  'SI': ['slowenien', 'slovenija'],
  // Lithuania
  'LT': ['litauen', 'lietuva'],
  // Latvia
  'LV': ['lettland', 'latvija'],
  // Estonia
  'EE': ['estland', 'eesti'],
  // Luxembourg
  'LU': ['luxemburg']
};

/**
 * Build a complete alias map for all countries
 * Combines ISO translations with informal aliases
 * @returns {Object} Map of country code to array of aliases (all lowercase)
 */
export function buildCountryAliases() {
  const aliasMap = {};
  
  // Get all country codes
  const allCodes = countries.getAlpha2Codes();
  
  for (const code of Object.keys(allCodes)) {
    const aliases = new Set();
    
    // Add the code itself (lowercase)
    aliases.add(code.toLowerCase());
    
    // Add Alpha-3 code
    const alpha3 = countries.alpha2ToAlpha3(code);
    if (alpha3) {
      aliases.add(alpha3.toLowerCase());
    }
    
    // Add names in all registered languages
    for (const lang of LANGUAGES) {
      const name = countries.getName(code, lang);
      if (name) {
        aliases.add(name.toLowerCase());
      }
    }
    
    // Add informal aliases if they exist
    if (INFORMAL_ALIASES[code]) {
      for (const alias of INFORMAL_ALIASES[code]) {
        aliases.add(alias.toLowerCase());
      }
    }
    
    aliasMap[code.toLowerCase()] = [...aliases];
  }
  
  return aliasMap;
}

/**
 * Get expanded search terms for a given query
 * If the query matches a country code or name, returns all aliases
 * @param {string} query - Search query
 * @returns {string[]} Array of search terms including aliases
 */
export function getSearchTerms(query) {
  const lower = query.toLowerCase();
  const terms = new Set([lower]);
  
  const aliasMap = buildCountryAliases();
  
  // Check if query matches any country code or alias
  for (const [code, aliases] of Object.entries(aliasMap)) {
    if (aliases.includes(lower)) {
      // Add all aliases for this country
      for (const alias of aliases) {
        terms.add(alias);
      }
      break; // Found a match, no need to continue
    }
  }
  
  return [...terms];
}

/**
 * Generate a static alias map for frontend use
 * This can be called at build time to create a JSON file
 * @returns {Object} The complete alias map
 */
export function generateStaticAliasMap() {
  return buildCountryAliases();
}

export default {
  buildCountryAliases,
  getSearchTerms,
  generateStaticAliasMap
};
