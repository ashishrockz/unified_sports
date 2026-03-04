/**
 * Escapes special regex characters in user-provided search strings
 * to prevent ReDoS (Regular Expression Denial of Service) attacks.
 */
const escapeRegex = (str) => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

module.exports = { escapeRegex };
