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
    assert(data.mission, 'data.mission not provided.');
    assert(data.access, 'data.access not provided.');
    assert(data.owner, 'data.owner not provided.');
    assert(params.user, 'params.user not provided');

    const svcMissions = this.app.service('missions');
    const getMission = (id) => svcMissions.get(id);

    const mission = await getMission(data.mission);
    assert(mission, 'data.mission is not exists.');
    data.loop = 0;
    data.status = 'ready';
    const defaultLane = fp.find(fp.propEq('default', true), mission.lanes || []);
    if (defaultLane) {
      data.performers = [{
        user: data.owner,
        lanes: { [defaultLane.name]: 'player' }
      }];
    }
    return super.create(data);
  }

  async remove (id, params) {
    return super.remove(id, params);
  }

  /**
   * Join a user mission with specified the role and lanes.
   */
  async join (id, data, params, orignal) {
    assert(orignal, 'user mission not exists');
    assert(orignal.access !== 'private', 'user mission is private');
    assert(data.lane, 'data.lane is not provided.');
    assert(fp.contains(data.role, ['player', 'observer']), 'data.role is not valid.');
    assert(data.player || data.user, 'data.player is not provided.');

    const getMission = async (id) => this.app.service('missions').get(id);
    const getPlayer = async (id) => id? this.app.service('users').get(id) : null;

    const [mission, player] = await Promise.all([
      getMission(orignal.mission),
      getPlayer(data.player)
    ]);
    assert(mission, 'mission not exists');
    if (data.player) assert(player, 'player not exists');

    const playerId = data.player || data.user; // player or current user
    const hasPerformer = fp.find(fp.idPropEq('user', playerId), orignal.performers || []);
    const lanes = fp.map(fp.prop('name'), mission.lanes || []);
    assert(fp.contains(data.lane, lanes), 'data.lane not exists in this mission');

    // process the join for public mission
    if (orignal.access === 'public') {
      if (hasPerformer) {
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
    assert(orignal, 'user mission not exists');
    assert(data.user, 'data.user is not provided.');

    // the owner himself cannot leave
    assert(orignal.owner !== data.player, 'You are owner of this mission yourself cannot leave.');
    const hasPerformer = fp.find(fp.idPropEq('user', data.user), orignal.performers || []);
    assert(hasPerformer, 'You are not a performer of this mission');

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
    assert(orignal, 'user mission not exists');
    assert(data.player, 'data.player is not provided.');

    // can only done by the owner of the mission and the owner himself cannot be kicked out.
    assert(orignal.owner === data.user, 'You must be owner of this mission to kick out someone.');
    assert(orignal.owner !== data.player, 'You are owner of this mission yourself cannot be kicked out.');
    const hasPerformer = fp.find(fp.idPropEq('user', data.player), orignal.performers || []);
    assert(hasPerformer, 'player is not a performer of this mission');

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
    assert(orignal, 'user mission not exists');
    assert(data.trigger, 'data.trigger is not provided.');
    assert(data.user, 'data.user is not provided.');
    data.scopes = data.scopes || []; // scope in which the scores will be counted

    // whether the user is one of the performers
    const performer = fp.find(fp.idPropEq('user', params.user.id), orignal.performers || []);
    assert(performer, 'data.user is not members of this mission, please join the mission first.');

    // get mission activities
    const svcMissions = this.app.service('missions');
    const mission = await svcMissions.get(helpers.getId(orignal.mission), {
      query: { $select: 'activities.requires,activities.rewards,*' }
    });
    assert(mission && mission.activities, 'mission not exists');

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
    assert(orignal, 'user mission not exists');
    assert(data.lane, 'data.lane is not provided.');
    assert(fp.contains(data.role, ['player', 'observer', 'false']), 'data.role is not valid.');
    assert(data.player || data.user, 'data.player is not provided.');
    if (data.role === 'false') data.role = null;

    const getMission = async (id) => this.app.service('missions').get(id);
    const getPlayer = async (id) => id? this.app.service('users').get(id) : null;

    const [mission, player] = await Promise.all([
      getMission(orignal.mission),
      getPlayer(data.player)
    ]);
    assert(mission, 'mission not exists');
    if (data.player) assert(player, 'player not exists');

    // whether the user is one of the performers
    const playerId = data.player || data.user; // player or current user
    const performer = fp.find(fp.idPropEq('user', playerId), orignal.performers || []);
    assert(performer, 'player is not members of this mission, please join the mission first.');

    const lanes = fp.map(fp.prop('name'), mission.lanes || []);
    assert(fp.contains(data.lane, lanes), 'data.lane not exists in this mission');

    // process the join for public mission
    if (orignal.access === 'public') {
      // remove a performer from the lane
      params.query = fp.assign(params.query, {
        'performers.user': playerId
      });
      return super.patch(id, {
        $unset: { [`performers.$.lanes.${data.lane}`]: '' }
      }, params);
    } else {
      // send role.change in notifier
      return orignal;
    }
  }
}

export default function init (app, options, hooks) {
  options = Object.assign({ ModelName: 'user-mission' }, options);
  return createService(app, UserMissionService, UserMissionModel, options);
}

init.Service = UserMissionService;
