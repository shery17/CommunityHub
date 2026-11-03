export const EVENT_CATEGORIES = Object.freeze([
  "Sports", "Education", "Volunteering", "Social", "Arts & Culture",
  "Health & Wellbeing", "Family & Kids",
]);

// These are application constants, never request input.
export const categoryCheckSql = `category IN (${EVENT_CATEGORIES.map(value => `'${value.replaceAll("'", "''")}'`).join(", ")})`;
