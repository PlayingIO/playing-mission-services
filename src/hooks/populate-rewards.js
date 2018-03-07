import assert from 'assert';
import fp from 'mostly-func';
import makeDebug from 'debug';
import { helpers } from 'mostly-feathers-mongoose';

const debug = makeDebug('playing:mission-services:hooks:populateRewards');

function getActivityRewards(activities) {
  return fp.reduce((arr, activity) => {
    if (activity.type === 'single') {
      return arr.concat(activity.rewards || []);
    } else {
      return arr.concat(fp.flatten(getActivityRewards(activity.activities || [])));
    }
  }, [], activities);
}

export default function populateRewards(target) {
  return (hook) => {
    assert(hook.type === 'after', `populateRewards must be used as a 'after' hook.`);

    let params = fp.assign({ query: {} }, hook.params);
    let data = helpers.getHookDataAsArray(hook);

    // target must be specified by $select to assoc
    if (!helpers.isSelected(target, params.query.$select)) return hook;

    // gether all rewards
    const rewards = fp.reduce((arr, mission) => {
      return arr.concat(getActivityRewards(mission.activities || []));
    }, [], data);
    return helpers.populateByService(hook.app, 'metric', 'type')(rewards).then(results => {
      return hook;
    });
  };
}