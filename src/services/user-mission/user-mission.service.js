import assert from 'assert';
import makeDebug from 'debug';
import { Service, helpers, createService } from 'mostly-feathers-mongoose';
import fp from 'mostly-func';
import { helpers as metrics } from 'playing-metric-services';
import { helpers as rules } from 'playing-rule-services';

import UserMissionModel from '../../models/user-mission.model';
import defaultHooks from './user-mission.hooks';
import { walkThroughTasks } from '../../helpers';

const debug = makeDebug('playing:mission-services:user-missions');

const defaultOptions = {
  name: 'user-missions',
  actions: {
    activities: 'user-mission-activities',
    invites: 'user-mission-invites'
  }
};

export class UserMissionService extends Service {
  constructor (options) {
    options = fp.assign(defaultOptions, options);
    super(options);
  }

  setup (app) {
    super.setup(app);
    this.hooks(defaultHooks(this.options));
  }

  async create (data, params) {
    data.loop = 0;
    data.status = 'READY';
    data.performers = [{
      user: data.owner,
      lanes: { [data.lane]: 'player' }
    }];
    return super.create(data, params);
  }

  /**
   * Approve mission join or role change request
   */
  async approval (id, data, params, original) {
    assert(original, 'User mission not exists.');

    // must be owner of the mission
    if (!fp.idEquals(original.owner, data.user)) {
      throw new Error('Only owner of the mission can approval the request.');
    }

    // check for pending requests
    const svcFeedsActivities = this.app.service('feeds/activities');
    const notification = `notification:${data.user}`;
    const requests = await svcFeedsActivities.find({
      primary: notification,
      $match: {
        _id: data.requestId
      }
    });
    if (fp.isEmpty(requests.data) || requests.data[0].state !== 'PENDING') {
      throw new Error('No pending request is found for this request id.');
    }

    const activity = requests.data[0];
    if (activity.verb === 'mission.join.request') {
      const user = helpers.getId(activity.actor);
      const roles = activity.roles;
      await this.join(original.id, { user, roles }, {}, original);
    }
    if (activity.verb === 'mission.roles.request') {
      const user = helpers.getId(activity.actor);
      const roles = activity.roles;
      await this.roles(original.id, { user, roles }, {}, original);
    }
    await svcFeedsActivities.patch(activity.id, {
      state: 'ACCEPTED'
    }, {
      primary: notification
    });

    return original;
  }

  /**
   * Play a mission. Playing a mission causes its state to change.
   */
  async play (id, data, params, original) {
    assert(original, 'User mission not exists.');

    // whether the user is one of the performers
    const performer = fp.find(fp.idPropEq('user', params.user.id), original.performers || []);
    if (!performer) {
      throw new Error('data.user is not members of this mission, please join the mission first.');
    }

    // get mission activities
    const svcMissions = this.app.service('missions');
    const mission = await svcMissions.get(helpers.getId(original.mission), {
      query: { $select: 'activities.requires,activities.rewards,*' }
    });
    assert(mission && mission.activities, 'Mission activities not exists.');

    // verify and get new tasks, TODO: task lane?
    const tasks = walkThroughTasks(params.user, original.tasks)(mission.activities);
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
    await super.patch(id, {
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
    const userMission = await super.patch(id, updateTask, {
      query: { 'tasks.key': task.key }
    });
    userMission.currentTask = task;

    // create reward for this task
    userMission.currentRewards = await metrics.createUserMetrics(this.app, data.user, task.rewards || []);

    return userMission;
  }

  /**
   * Change own roles or roles of a performer in mission.
   */
  async roles (id, data, params, original) {
    assert(original, 'User mission not exists.');

    // must be owner of the mission for other player
    if (data.player && !fp.idEquals(original.owner, data.user)) {
      throw new Error('Only owner of the mission can change roles of a player.');
    }

    // whether the user is one of the performers
    const playerId = data.player || data.user; // player or current user
    const performer = fp.find(fp.idPropEq('user', playerId), original.performers || []);
    if (!performer) {
      throw new Error('Player is not members of this mission, please join the mission first.');
    }

    // process the change if owner or it's a public mission
    if (fp.idEquals(original.owner, data.user) || original.access === 'PUBLIC') {
      // remove a performer from the lane
      params.query = fp.assign(params.query, {
        'performers.user': playerId
      });
      const updates = fp.reduce((acc, lane) => {
        if (data.roles[lane] !== 'false') {
          acc[`performers.$.lanes.${lane}`] = data.roles[lane];
        } else {
          acc['$unset'] = acc['$unset'] || [];
          acc['$unset'].push({ [`performers.$.lanes.${lane}`]: '' });
        }
        return acc;
      }, {}, fp.keys(data.roles));
      return super.patch(id, updates, params);
    } else {
      // send mission.role in notifier
      return original;
    }
  }

  /**
   * Transfer mission ownership to existing performer or any other player
   */
  async transfer (id, data, params, original) {
    assert(original, 'User mission not exists.');

    // must be owner of the mission
    if (!fp.idEquals(original.owner, data.user)) {
      throw new Error('Only owner of the mission can transfer ownership.');
    }
    if (fp.idEquals(original.owner, data.player)) {
      throw new Error('Already owner of the mission.');
    }
    const performer = fp.find(fp.idPropEq('user', data.player), original.performers || []);

    if (performer) {
      params.query = fp.assign(params.query, {
        'performers.user': data.player
      });
      const updates = fp.reduce((acc, lane) => {
        return fp.assoc(`performers.$.lanes.${lane}`, data.roles[lane]);
      }, {}, fp.keys(data.roles));
      updates.owner = data.player;
      return super.patch(id, updates, params);
    } else {
      return super.patch(id, {
        owner: data.player,
        $addToSet: {
          performers: {
            user: data.player,
            lanes: data.roles
          }
        }
      }, params);
    }
  }
}

export default function init (app, options, hooks) {
  options = fp.assign({ ModelName: 'user-mission' }, options);
  return createService(app, UserMissionService, UserMissionModel, options);
}

init.Service = UserMissionService;
