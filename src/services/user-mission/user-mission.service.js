import assert from 'assert';
import makeDebug from 'debug';
import { Service, helpers, createService } from 'mostly-feathers-mongoose';
import fp from 'mostly-func';

import UserMissionModel from '~/models/user-mission.model';
import defaultHooks from './user-mission.hooks';

const debug = makeDebug('playing:mission-services:user-missions');

const defaultOptions = {
  name: 'user-missions'
};

class UserMissionService extends Service {
  constructor(options) {
    options = Object.assign({}, defaultOptions, options);
    super(options);
  }

  setup(app) {
    super.setup(app);
    this.hooks(defaultHooks(this.options));
  }

  async create(data, params) {
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
        lanes: [{ lane: defaultLane.name, role: 'player' }]
      }];
    }
    return super.create(data);
  }

  /**
   * Join a user mission with specified the role and lanes.
   */
  async _join(id, data, params, orignal) {
    assert(orignal, 'user mission not exists');
    assert(data.lane, 'data.lane is not provided.');
    assert(data.role, 'data.role is not provided.');
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
    const hasPerformer = fp.find(p => String(p.user) === playerId, orignal.performers || []);
    const lanes = fp.map(fp.prop('name'), mission.lanes || []);
    assert(fp.contains(data.lane, lanes), 'data.lane not exists in this mission');

    // TODO check the permission for join the group

    if (hasPerformer) {
      params.query = fp.assign(params.query, {
        'performers.user': playerId
      });
      return super.patch(id, {
        $addToSet: {
          'performers.$.lanes': { role: data.role, lane: data.lane }
        }
      }, params);
    } else {
      return super.patch(id, {
        $addToSet: {
          performers: {
            user: playerId,
            lanes: [{ role: data.role, lane: data.lane }]
          }
        }
      }, params);
    }
  }

  /**
   * Leave a user mission.
   */
  async _leave(id, data, params, orignal) {
    assert(orignal, 'user mission not exists');
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
    const hasPerformer = fp.find(p => String(p.user) === playerId, orignal.performers || []);
    assert(hasPerformer, 'player is not a performer of this mission');

    // TODO check the permission for leave the group

    return super.patch(id, {
      $pull: {
        'performers': { user: playerId }
      }
    }, params);
  }

  /**
   * Play a user mission. Playing a mission causes its state to change.
   */
  async _play(id, data, params, orignal) {
    assert(orignal, 'user mission not exists');
    assert(data.trigger, 'data.trigger is not provided.');
    assert(data.user, 'data.user is not provided.');
    data.scopes = data.scopes || []; // scope in which the scores will be counted

    // whether the user is one of the performers
    const performer = fp.find(performer => {
      return helpers.getId(performer.user) === helpers.getId(params.user);
    }, orignal.performers || []);
    assert(performer, 'data.user is not members of this mission, please join the mission first.');

    // check the state of the task
    const task = fp.find(fp.propEq('key', data.trigger), orignal.tasks);
    if (!task) {
      throw new Error('Requirements not meet, You can not play the trigger yet.');
    }
    if (task.state === 'completed') {
      throw new Error('Trigger has already been played by someone else.');
    }

    // create reward for this task
    const svcUserMetrics = this.app.service('user-metrics');
    const createRewards = fp.reduce((arr, reward) => {
      if (reward.metric) {
        reward.metric = helpers.getId(reward.metric.id);
        reward.user = data.user;
        arr.push(svcUserMetrics.create(reward));
      }
      return arr;
    }, []);

    return task;
  }
}

export default function init(app, options, hooks) {
  options = Object.assign({ ModelName: 'user-mission' }, options);
  return createService(app, UserMissionService, UserMissionModel, options);
}

init.Service = UserMissionService;
