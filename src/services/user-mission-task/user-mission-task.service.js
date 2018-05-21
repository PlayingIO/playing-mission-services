import assert from 'assert';
import makeDebug from 'debug';
import { helpers } from 'mostly-feathers-mongoose';
import fp from 'mostly-func';
import { helpers as metrics } from 'playing-metric-services';
import { helpers as rules } from 'playing-rule-services';

import defaultHooks from './user-mission-task.hooks';
import { walkThroughTasksReady } from '../../helpers';

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
    assert(userMission, 'User mission is not exists');
    const activities = userMission.definition && userMission.definition.activities;
    if (fp.isNotEmpty(activities)) {
      return walkThroughTasksReady(params.user, userMission.tasks)(activities);
    } else {
      return [];
    }
  }

  /**
   * Play a task of user mission causes its state to change.
   */
  async create (data, params) {
    let userMission = params.userMission;
    assert(userMission, 'User mission is not exists.');

    // whether the user is one of the performers
    const performer = fp.find(fp.idPropEq('user', params.user.id), userMission.performers || []);
    if (!performer) {
      throw new Error('User is not members of this mission, please join the mission first.');
    }

    // get mission activities
    const activities = userMission.definition && userMission.definition.activities;
    if (fp.isEmpty(activities)) {
      return { tasks: [], rewards: [] };
    }

    // verify and get new tasks, TODO: task lane?
    const tasksReady = walkThroughTasksReady(params.user, userMission.tasks)(activities);
    const trigger = fp.find(fp.propEq('key', data.trigger), tasksReady);
    const activity = fp.dotPath(fp.replace('\.', '.activities.', data.trigger), activities);

    // check the state of the corresponding task
    if (!trigger || !activity || trigger.name !== activity.name) {
      throw new Error('Requirements not meet, You can not play the trigger yet.');
    }
    if (trigger.state === 'COMPLETED') {
      throw new Error('Task has already been completed.');
    }
    let state = 'COMPLETED';
    activity.loop = parseInt(activity.loop);
    if (activity.loop) {
      const loop = trigger.loop || 0;
      if (loop >= activity.loop) {
        throw new Error(`Number of times exceeds, task can only performed ${activity.loop} times.`);
      } else {
        state = (loop + 1 >= activity.loop)? 'COMPLETED' : 'ACTIVE';
      }
    }

    // add task to the mission if not exists
    const svcUserMissions = this.app.service('user-missions');
    await svcUserMissions.patch(userMission.id, {
      $push: { tasks: trigger }
    }, {
      query: { 'tasks.key': { $ne: trigger.key } }
    });

    let updateTask = {
      $inc: { 'tasks.$.loop': 1 },
      $set: { 'tasks.$.state': state },
      $addToSet: { 'tasks.$.performers': { user: params.user.id, scopes: data.scopes } }
    };

    // rate limiting the task
    if (activity.rate && activity.rate.frequency) {
      let { count, firstRequest, lastRequest, expiredAt } = rules.checkRateLimit(activity.rate, trigger.limit || {});
      updateTask.$inc['tasks.$.limit.count'] = count;
      updateTask.$set['tasks.$.limit.firstRequest'] = firstRequest;
      updateTask.$set['tasks.$.limit.lastRequest'] = lastRequest;
      updateTask.$set['tasks.$.limit.expiredAt'] = expiredAt;
    }

    // update task state and performers
    userMission = await svcUserMissions.patch(userMission.id, updateTask, {
      query: {
        'tasks.key': trigger.key,
        $select: 'mission.activities.requires,mission.activities.rewards,*'
      }
    });
    trigger.state = state;

    // find next available tasks
    const nextTasks = await this.find({
      user: params.user,
      primary: userMission.id,
      userMission: userMission
    });

    // create reward for this task
    let rewards = [];
    if (state === 'COMPLETED') {
      rewards = await metrics.createUserMetrics(this.app, params.user.id, trigger.rewards || []);
      // TODO: create delay rewards for this resolution task
    }

    params.locals = { userMission, trigger, activity, rewards }; // for notifier

    return { tasks: nextTasks, rewards };
  }
}

export default function init (app, options, hooks) {
  return new UserMissionTaskService(options);
}

init.Service = UserMissionTaskService;
