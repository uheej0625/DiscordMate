/**
 * Timestamp utility functions for converting various date formats to ISO 8601 strings
 */

/**
 * Converts various timestamp formats to ISO 8601 string format
 * @param {string|number|Date|null|undefined} input - The date/time value to convert
 * @returns {string} ISO 8601 formatted timestamp string
 */
function convertToISO(input) {
  // Return current time if no input
  if (!input) {
    return new Date().toISOString();
  }

  // Handle numeric timestamps (Unix time in ms)
  if (typeof input === 'number') {
    return new Date(input).toISOString();
  }

  // Handle Date objects
  if (input instanceof Date) {
    return input.toISOString();
  }

  // Handle string inputs
  if (typeof input === 'string') {
    // Already in ISO format (contains 'T' separator)
    if (input.includes('T')) {
      return input;
    }
    // Convert other string formats to ISO
    return new Date(input).toISOString();
  }
  
  // Fallback to current time if format is unrecognized
  return new Date().toISOString();
}

export default convertToISO;
