import assert from 'assert';
import fp from 'mostly-func';
import makeDebug from 'debug';
import { helpers } from 'mostly-feathers-mongoose';
import { helpers as rules } from 'playing-rule-services';

const debug = makeDebug('playing:mission-services:hooks:populateRequires');

function getActivityRequires(activities) {
  return fp.reduce((arr, activity) => {
    if (activity.type === 'single') {
      arr.push(activity.requires || []);
    } else {
      arr.push(fp.flatten(getActivityRequires(activity.activities || [])));
    }
    return arr;
  }, [], activities);
}

export default function populateRequires(target) {
  return (hook) => {
    assert(hook.type === 'after', `populateRequires must be used as a 'after' hook.`);

    let params = fp.assign({ query: {} }, hook.params);
    let data = helpers.getHookDataAsArray(hook);

    // target must be specified by $select to assoc
    if (!helpers.isSelected(target, params.query.$select)) return hook;

    // gether all requires in activites, as array of conditions array
    const requires = fp.reduce((arr, mission) => {
      return arr.concat(getActivityRequires(mission.activities || []));
    }, [], data);
    const metricRules = fp.flatten(fp.map(rules.getMetricRules, requires));
    return helpers.populateByService(hook.app, 'metric', 'type')(metricRules).then(results => {
      return hook;
    });
  };
}