import glob from 'glob';
import path from 'path';
import { activity } from './activity.schema';
import { notify } from './notify.schema';

// load all models
const modelFiles = glob.sync(path.join(__dirname, './*.model.js'));
export default Object.assign({
  activities: { schema: [activity] },
  notify: { schema: notify }
}, ...modelFiles.map(file => {
  const name = path.basename(file, '.model.js');
  return { name: require(file).default };
}));
