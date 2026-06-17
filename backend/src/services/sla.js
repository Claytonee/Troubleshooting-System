const { SLA_TARGET_HOURS } = require('../config/schemaExtensions');

/** Hours allowed for a given priority before SLA breach. */
function targetHours(priority) {
  return SLA_TARGET_HOURS[priority] || SLA_TARGET_HOURS.medium;
}

module.exports = { SLA_TARGET_HOURS, targetHours };
