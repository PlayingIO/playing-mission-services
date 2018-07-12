const { camelCase } = require('mostly-func');
const glob = require('glob');
const path = require('path');
const { activity } = require('./activity.schema');
const { notify } = require('./notify.schema');

// load all models
const modelFiles = glob.sync(path.join(__dirname, './*.model.js'));
module.exports = Object.assign({
  activities: { schema: [activity] },
  notify: { schema: notify }
}, ...modelFiles.map(file => {
  const name = camelCase(path.basename(file, '.model.js'));
  return { [name]: require(file) };
}));
