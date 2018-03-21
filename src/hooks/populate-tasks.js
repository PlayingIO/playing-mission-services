import assert from 'assert';
import fp from 'mostly-func';
import makeDebug from 'debug';
import { helpers } from 'mostly-feathers-mongoose';
import { walkThroughTasks } from '../helpers';

const debug = makeDebug('playing:mission-services:hooks:populateTasks');

const getRequiresField = (target) => fp.reduce((arr, item) => {
  arr.push(helpers.getField(item, target) || []);
  return arr;
}, []);

export default function populateTasks (target, getRequires) {
  return async function (context) {
    assert(context.type === 'after', `populateTasks must be used as a 'after get' hook.`);

    assert(context.params.user, 'Cannot view tasks without logined.');

    const svcMissions = this.app.service('missions');

    let data = helpers.getHookDataAsArray(context);

    const missionIds = fp.uniq(
      fp.reject(fp.isNil,
      fp.map(helpers.pathId('mission'), data)));
    const missions = await svcMissions.find({
      query: {
        id: { $in: missionIds },
        $select: 'activities.requires,activities.rewards,*'
      },
      paginate: false
    });
    for (let userMission of data) {
      const mission = fp.find(fp.propEq('id', helpers.getId(userMission.mission)), missions);
      if (mission && mission.activities) {
        userMission.tasks = walkThroughTasks(
          context.params.user, userMission.tasks || [], []
        )(mission.activities);
      }
    }

    return context;
  };
}