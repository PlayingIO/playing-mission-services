import glob from 'glob';
import path from 'path';
import { activity } from './activity-schema';
import { notify } from './notify-schema';

// load all models
let modelFiles = glob.sync(path.join(__dirname, './*-model.js'));
modelFiles.forEach(file => {
  let name = path.basename(file, '-model.js');
  module.exports[name] = require(file);
});

module.exports.activities = { schema: [activity] };
module.exports.notify = { schema: notify };
