'use strict';
const storage = require('./storage');

function _selectMonthWindows(now) { return []; }
function _computeCategories(expenses, windows) { return {}; }
async function buildPrediction(userId, _options, clientOverride) {
  return { sufficient: false };
}
module.exports = { buildPrediction, _selectMonthWindows, _computeCategories };
