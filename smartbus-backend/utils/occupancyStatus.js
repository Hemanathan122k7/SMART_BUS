/**
 * Compute occupancy status label from occupancy and capacity.
 * @param {number} occupancy
 * @param {number} capacity
 * @returns {string} empty | available | filling | nearly_full | full
 */
function getOccupancyStatus(occupancy, capacity) {
  const ratio = capacity > 0 ? (occupancy / capacity) * 100 : 0;

  if (ratio === 0) return 'empty';
  if (ratio <= 50) return 'available';
  if (ratio <= 80) return 'filling';
  if (ratio < 100) return 'nearly_full';
  return 'full';
}

module.exports = { getOccupancyStatus };
