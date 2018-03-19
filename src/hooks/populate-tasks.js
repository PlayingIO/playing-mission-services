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

export default function populateTasks(target, getRequires) {
  return async function (context) {
    assert(context.type === 'after', `populateTasks must be used as a 'after get' hook.`);

    const svcMissions = this.app.service('missions');

    let data = helpers.getHookDataAsArray(context);

    const missions = await svcMissions.find({
      query: {
        id: { $in: fp.uniq(fp.map(helpers.pathId('mission'), data)) },
        $select: 'activities.requires,activities.rewards'
      },
      paginate: false
    });
    for (let userMission of data) {
      const mission = fp.find(fp.propEq('id', helpers.getId(userMission.mission)), missions);
      if (mission && mission.activities) {
        // userMission.tasks = [
        //   { key: "0", name: "step1", state: 'completed' },
        //   { key: "1.0", name: "step2-1", state: 'completed' },
        //   { key: "1.1", name: "step2-2", state: 'completed' },
        //   { key: "2.0", name: "step3-1", state: 'completed' },
        //   { key: "2.1", name: "step3-2", state: 'completed' },
        //   { key: "3.1", name: "step4-2", state: 'completed' },
        //   { key: "4", name: "step5", state: 'completed' },
        // ];
        userMission.tasks = walkThroughTasks(context.params.user,
          userMission.tasks || [], [])(mission.activities);
      }
    }

    return context;
  };
}