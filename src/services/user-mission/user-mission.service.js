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
  name: 'user-missions'
};

export class UserMissionService extends Service {
  constructor (options) {
    options = Object.assign({}, defaultOptions, options);
    super(options);
  }

  setup (app) {
    super.setup(app);
    this.hooks(defaultHooks(this.options));
  }

  async create (data, params) {
    data.loop = 0;
    data.status = 'ready';
    data.performers = [{
      user: data.owner,
      lanes: { [data.lane]: 'player' }
    }];
    return super.create(data);
  }

  /**
   * Join a user mission with specified the role and lanes.
   */
  async join (id, data, params, orignal) {
    assert(orignal, 'User mission not exists.');
    assert(orignal.access !== 'private', 'The mission is private, cannot join.');

    const playerId = data.player || data.user; // player or current user
    const performer = fp.find(fp.idPropEq('user', playerId), orignal.performers || []);

    // process the join for public mission
    if (orignal.access === 'public') {
      if (performer) {
        params.query = fp.assign(params.query, {
          'performers.user': playerId
        });
        return super.patch(id, {
          [`performers.$.lanes.${data.lane}`]: data.role
        }, params);
      } else {
        return super.patch(id, {
          $addToSet: {
            performers: {
              user: playerId,
              lanes: { [data.lane]: data.role }
            }
          }
        }, params);
      }
    } else {
      // send join.request in notifier
      return orignal;
    }
  }

  /**
   * Leave a user mission.
   */
  async leave (id, data, params, orignal) {
    assert(orignal, 'User mission not exists.');

    // the owner himself cannot leave
    assert(!fp.idEquals(orignal.owner, data.user), 'Owner of the mission cannot leave yourself.');
    const performer = fp.find(fp.idPropEq('user', data.user), orignal.performers || []);
    assert(performer, 'You are not a performer of this mission.');

    return super.patch(id, {
      $pull: {
        'performers': { user: data.user }
      }
    }, params);
  }

  /**
   * Kick out a performer from the mission.
   */
  async kick (id, data, params, orignal) {
    assert(orignal, 'User mission not exists');

    // can only done by the owner of the mission and the owner himself cannot be kicked out.
    assert(fp.idEquals(orignal.owner, data.user), 'Only owner of the mission can kick a player.');
    assert(fp.idNotEquals(orignal.owner, data.player), 'Owner of the mission cannot kick yourself.');

    const performer = fp.find(fp.idPropEq('user', data.player), orignal.performers || []);
    assert(performer, 'Player is not a member of the mission');

    return super.patch(id, {
      $pull: {
        'performers': { user: data.player }
      }
    }, params);
  }

  /**
   * Play a user mission. Playing a mission causes its state to change.
   */
  async play (id, data, params, orignal) {
    assert(orignal, 'User mission not exists.');

    // whether the user is one of the performers
    const performer = fp.find(fp.idPropEq('user', params.user.id), orignal.performers || []);
    assert(performer, 'data.user is not members of this mission, please join the mission first.');

    // get mission activities
    const svcMissions = this.app.service('missions');
    const mission = await svcMissions.get(helpers.getId(orignal.mission), {
      query: { $select: 'activities.requires,activities.rewards,*' }
    });
    assert(mission && mission.activities, 'Mission activities not exists.');

    // verify and get new tasks, TODO: task lane?
    const tasks = walkThroughTasks(params.user, orignal.tasks)(mission.activities);
    const task = fp.find(fp.propEq('key', data.trigger), tasks);
    const activity = fp.dotPath(data.trigger, mission.activities);

    // check the state of the corresponding task
    if (!task || !activity || task.name !== activity.name) {
      throw new Error('Requirements not meet, You can not play the trigger yet.');
    }
    if (task.state === 'completed') {
      throw new Error('Task has already been completed.');
    }
    let state = 'completed';
    if (activity.loop) {
      const loop = task.loop || 0;
      if (loop >= activity.loop) {
        throw new Error(`Number of times exceeds, task can only performed ${activity.loop} times.`);
      } else {
        state = (loop + 1 >= activity.loop)? 'completed' : 'active';
      }
    }

    // add task to the user mission if not exists
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
   * Change own roles in mission.
   */
  async roles (id, data, params, orignal) {
    assert(orignal, 'User mission not exists.');

    // whether the user is one of the performers
    const playerId = data.player || data.user; // player or current user
    const performer = fp.find(fp.idPropEq('user', playerId), orignal.performers || []);
    assert(performer, 'Player is not members of this mission, please join the mission first.');

    // process the join for public mission
    if (orignal.access === 'public') {
      // remove a performer from the lane
      params.query = fp.assign(params.query, {
        'performers.user': playerId
      });
      if (data.role === 'false') {
        return super.patch(id, {
          $unset: { [`performers.$.lanes.${data.lane}`]: '' }
        }, params);
      } else {
        return super.patch(id, {
          [`performers.$.lanes.${data.lane}`]: data.role
        }, params);
      }
    } else {
      // send mission.role in notifier
      return orignal;
    }
  }

  /**
   * Transfer mission ownership to existing performer or any other player
   */
  async transfer (id, data, params, orignal) {
    assert(orignal, 'User mission not exists.');

    // can only done by the owner of the mission
    assert(fp.idEquals(orignal.owner, data.user), 'Only owner of the mission can transfer ownership..');
    assert(fp.idNotEquals(orignal.owner, data.player), 'Already owner of the mission.');
    const performer = fp.find(fp.idPropEq('user', data.player), orignal.performers || []);
    assert(performer, 'Player is not a performer of this mission');

    if (performer) {
      params.query = fp.assign(params.query, {
        'performers.user': data.player
      });
      return super.patch(id, {
        owner: data.player,
        [`performers.$.lanes.${data.lane}`]: data.role
      }, params);
    } else {
      return super.patch(id, {
        owner: data.player,
        $addToSet: {
          performers: {
            user: data.player,
            lanes: { [data.lane]: data.role }
          }
        }
      }, params);
    }
  }
}

export default function init (app, options, hooks) {
  options = Object.assign({ ModelName: 'user-mission' }, options);
  return createService(app, UserMissionService, UserMissionModel, options);
}

init.Service = UserMissionService;
