/**
 * Safely parse JSON objects with circular references
 * This utility handles circular references by replacing them with "[Circular]"
 * to prevent "Maximum call stack size exceeded" errors
 */

/**
 * Safely stringify and parse an object, handling circular references
 * @param obj Any JavaScript object that might contain circular references
 * @returns A new object with circular references replaced by "[Circular]"
 */
export const safeJsonParse = (obj: any) => {
  const seen = new WeakSet();
  return JSON.parse(JSON.stringify(obj, (key, value) => {
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) return "[Circular]";
      seen.add(value);
    }
    return value;
  }));
};

/**
 * Safely stringify an object, handling circular references
 * @param obj Any JavaScript object that might contain circular references
 * @returns A JSON string with circular references replaced by "[Circular]"
 */
export const safeJsonStringify = (obj: any) => {
  const seen = new WeakSet();
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) return "[Circular]";
      seen.add(value);
    }
    return value;
  });
};
