/**
 * Timestamp utility functions for converting various date formats to ISO 8601 strings
 */

/**
 * Converts various timestamp formats to ISO 8601 string format
 * @param {string|number|Date|null|undefined} input - The date/time value to convert
 * @returns {string} ISO 8601 formatted timestamp string
 */
function convertToISO(input) {
  if (!input) {
    return new Date().toISOString();
  } else if (typeof input === 'number') {
    return new Date(input).toISOString();
  } else if (input instanceof Date) {
    return input.toISOString();
  } else if (typeof input === 'string' && !input.includes('T')) {
    return new Date(input).toISOString();
  } else if (typeof input === 'string' && input.includes('T')) {
    // Already in ISO format, return as is
    return input;
  }
  
  // Fallback to current time if format is unrecognized
  return new Date().toISOString();
}

export { convertToISO };
