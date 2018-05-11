import assert from 'assert';
import makeDebug from 'debug';
import { helpers } from 'mostly-feathers-mongoose';
import fp from 'mostly-func';
import { helpers as metrics } from 'playing-metric-services';
import { helpers as rules } from 'playing-rule-services';

import defaultHooks from './user-mission-task.hooks';
import { walkThroughTasks } from '../../helpers';

const debug = makeDebug('playing:mission-services:user-missions/tasks');

const defaultOptions = {
  name: 'user-missions/tasks'
};

export class UserMissionTaskService {
  constructor (options) {
    this.options = fp.assignAll(defaultOptions, options);
    this.name = this.options.name;
  }

  setup (app) {
    this.app = app;
    this.hooks(defaultHooks(this.options));
  }

  /**
   * Get a list of all available tasks a player can play in a user mission
   */
  async find (params) {
    const userMission = params.userMission;
    const mission = userMission.mission;
    if (mission && fp.isNotEmpty(mission.activities)) {
      return walkThroughTasks(params.user, userMission.tasks)(mission.activities);
    } else {
      return [];
    }
  }

  /**
   * Play a task of user mission causes its state to change.
   */
  async create (data, params) {
    const userMission = params.userMission;
    assert(userMission, 'User mission not exists.');

    // whether the user is one of the performers
    const performer = fp.find(fp.idPropEq('user', params.user.id), userMission.performers || []);
    if (!performer) {
      throw new Error('data.user is not members of this mission, please join the mission first.');
    }

    // get mission activities
    const mission = userMission.mission;
    if (fp.isEmpty(mission && mission.activities)) {
      return { tasks: [], rewards: [] };
    }

    // verify and get new tasks, TODO: task lane?
    const tasks = walkThroughTasks(params.user, userMission.tasks)(mission.activities);
    const task = fp.find(fp.propEq('key', data.trigger), tasks);
    const activity = fp.dotPath(data.trigger, mission.activities);

    // check the state of the corresponding task
    if (!task || !activity || task.name !== activity.name) {
      throw new Error('Requirements not meet, You can not play the trigger yet.');
    }
    if (task.state === 'COMPLETED') {
      throw new Error('Task has already been completed.');
    }
    let state = 'COMPLETED';
    if (activity.loop) {
      const loop = task.loop || 0;
      if (loop >= activity.loop) {
        throw new Error(`Number of times exceeds, task can only performed ${activity.loop} times.`);
      } else {
        state = (loop + 1 >= activity.loop)? 'COMPLETED' : 'ACTIVE';
      }
    }

    // add task to the mission if not exists
    const svcUserMissions = this.app.service('user-missions');
    await svcUserMissions.patch(userMission.id, {
      $push: { tasks: task }
    }, {
      query: { 'tasks.key': { $ne: task.key } }
    });

    let updateTask = {
      $inc: { 'tasks.$.loop': 1 },
      $set: { 'tasks.$.state': state },
      $addToSet: { 'tasks.$.performers': { user: data.user, scopes: data.scopes } }
    };

    // rate limiting the task
    if (activity.rate && activity.rate.frequency) {
      let { count, firstRequest, lastRequest, expiredAt } = rules.checkRateLimit(activity.rate, task.limit || {});
      updateTask.$inc['tasks.$.limit.count'] = count;
      updateTask.$set['tasks.$.limit.firstRequest'] = firstRequest;
      updateTask.$set['tasks.$.limit.lastRequest'] = lastRequest;
      updateTask.$set['tasks.$.limit.expiredAt'] = expiredAt;
    }

    // update task state and performers
    const result = await svcUserMissions.patch(userMission.id, updateTask, {
      query: {
        'tasks.key': task.key,
        $select: 'mission.activities.requires,mission.activities.rewards,*'
      }
    });

    // find next available tasks
    const nextTasks = await this.find({
      user: params.user,
      primary: userMission.id,
      userMission: result
    });

    // create reward for this task
    const rewards = await metrics.createUserMetrics(this.app, params.user.id, task.rewards || []);

    return { tasks: nextTasks, rewards };
  }
}

export default function init (app, options, hooks) {
  return new UserMissionTaskService(options);
}

init.Service = UserMissionTaskService;
