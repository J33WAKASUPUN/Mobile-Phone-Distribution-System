/**
 * Date Utilities for Sri Lanka Timezone (UTC+5:30)
 */

/**
 * Get current date/time in Sri Lanka timezone
 * @returns {Date} Current date in Sri Lanka timezone
 */
const getSriLankaTime = () => {
  const now = new Date();
  
  // Convert to Sri Lanka timezone (UTC+5:30)
  const utcOffset = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds
  const sriLankaTime = new Date(now.getTime() + utcOffset);
  
  return sriLankaTime;
};

/**
 * Convert UTC date to Sri Lanka timezone
 * @param {Date} utcDate - UTC date
 * @returns {Date} Date in Sri Lanka timezone
 */
const toSriLankaTime = (utcDate) => {
  const utcOffset = 5.5 * 60 * 60 * 1000;
  return new Date(utcDate.getTime() + utcOffset);
};

/**
 * Format date for Sri Lanka (YYYY-MM-DD)
 * @param {Date} date - Date to format
 * @returns {string} Formatted date string
 */
const formatSriLankaDate = (date = new Date()) => {
  const sriLankaDate = toSriLankaTime(date);
  
  const year = sriLankaDate.getUTCFullYear();
  const month = String(sriLankaDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(sriLankaDate.getUTCDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

/**
 * Format time for Sri Lanka (HH:MM:SS)
 * @param {Date} date - Date to format
 * @returns {string} Formatted time string
 */
const formatSriLankaTime = (date = new Date()) => {
  const sriLankaDate = toSriLankaTime(date);
  
  const hours = String(sriLankaDate.getUTCHours()).padStart(2, '0');
  const minutes = String(sriLankaDate.getUTCMinutes()).padStart(2, '0');
  const seconds = String(sriLankaDate.getUTCSeconds()).padStart(2, '0');
  
  return `${hours}:${minutes}:${seconds}`;
};

/**
 * Format date and time for Sri Lanka
 * @param {Date} date - Date to format
 * @returns {Object} Object with date and time
 */
const formatSriLankaDateTime = (date = new Date()) => {
  return {
    date: formatSriLankaDate(date),
    time: formatSriLankaTime(date),
    dateTime: `${formatSriLankaDate(date)} ${formatSriLankaTime(date)}`,
  };
};

/**
 * Get start of day in Sri Lanka timezone
 * @param {Date} date - Input date
 * @returns {Date} Start of day in Sri Lanka timezone
 */
const getStartOfDaySriLanka = (date = new Date()) => {
  const sriLankaDate = toSriLankaTime(date);
  sriLankaDate.setUTCHours(0, 0, 0, 0);
  
  // Convert back to UTC for storage
  const utcOffset = 5.5 * 60 * 60 * 1000;
  return new Date(sriLankaDate.getTime() - utcOffset);
};

/**
 * Get end of day in Sri Lanka timezone
 * @param {Date} date - Input date
 * @returns {Date} End of day in Sri Lanka timezone
 */
const getEndOfDaySriLanka = (date = new Date()) => {
  const sriLankaDate = toSriLankaTime(date);
  sriLankaDate.setUTCHours(23, 59, 59, 999);
  
  // Convert back to UTC for storage
  const utcOffset = 5.5 * 60 * 60 * 1000;
  return new Date(sriLankaDate.getTime() - utcOffset);
};

/**
 * Check if date is today in Sri Lanka timezone
 * @param {Date} date - Date to check
 * @returns {boolean} True if date is today
 */
const isToday = (date) => {
  const today = formatSriLankaDate();
  const checkDate = formatSriLankaDate(date);
  return today === checkDate;
};

module.exports = {
  getSriLankaTime,
  toSriLankaTime,
  formatSriLankaDate,
  formatSriLankaTime,
  formatSriLankaDateTime,
  getStartOfDaySriLanka,
  getEndOfDaySriLanka,
  isToday,
};