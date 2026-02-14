/**
 * Intelligence feed types (aligned with reference design).
 * API incidents are mapped to IntelligenceItem for the card component.
 */

export const IntelligenceCategory = {
  OPERATIONAL: "OPERATIONAL",
  REPUTATION: "REPUTATION",
  REGULATORY: "REGULATORY",
};

export const ConfidenceLevel = {
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  LOW: "LOW",
};

/**
 * @typedef {Object} IntelligenceSource
 * @property {string} id
 * @property {string} label
 * @property {string} url
 * @property {string} type - e.g. 'trustpilot', 'reddit', 'twitter', 'web'
 * @property {string} domain
 * @property {string} [date]
 */

/**
 * @typedef {Object} IntelligenceItem
 * @property {string} id
 * @property {keyof IntelligenceCategory} category
 * @property {string} date - YYYY-MM-DD
 * @property {string} title
 * @property {string} summary
 * @property {keyof ConfidenceLevel} confidence
 * @property {string[]} tags
 * @property {IntelligenceSource[]} sources
 */
