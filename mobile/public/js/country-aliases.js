/**
 * Country Aliases Module for Frontend
 * 
 * Loads country aliases from generated JSON and provides search term expansion.
 * The JSON is generated at build time from i18n-iso-countries package.
 * 
 * @module country-aliases
 */

let countryAliases = null;

/**
 * Load country aliases from JSON file
 * @returns {Promise<Object>} Country aliases map
 */
export async function loadCountryAliases() {
  if (countryAliases) return countryAliases;
  
  try {
    const response = await fetch('./js/country-aliases.json');
    if (!response.ok) {
      console.warn('Failed to load country aliases, using empty map');
      countryAliases = {};
      return countryAliases;
    }
    countryAliases = await response.json();
    console.log(`Loaded ${Object.keys(countryAliases).length} country aliases`);
    return countryAliases;
  } catch (error) {
    console.warn('Error loading country aliases:', error);
    countryAliases = {};
    return countryAliases;
  }
}

/**
 * Get expanded search terms for a given query
 * If the query matches a country code or name, returns all aliases
 * @param {string} query - Search query (lowercase)
 * @returns {string[]} Array of search terms including aliases
 */
export function getSearchTerms(query) {
  if (!countryAliases) {
    // Aliases not loaded yet, return just the query
    return [query];
  }
  
  const terms = new Set([query]);
  
  // Check if query matches any country code or alias
  for (const [code, aliases] of Object.entries(countryAliases)) {
    if (aliases.includes(query)) {
      // Add all aliases for this country
      for (const alias of aliases) {
        terms.add(alias);
      }
      break; // Found a match, no need to continue
    }
  }
  
  return [...terms];
}

export default {
  loadCountryAliases,
  getSearchTerms
};
