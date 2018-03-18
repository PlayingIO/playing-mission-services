import assert from 'assert';
import makeDebug from 'debug';
import { Service, helpers, createService } from 'mostly-feathers-mongoose';
import fp from 'mostly-func';

import UserMissionModel from '~/models/user-mission.model';
import defaultHooks from './user-mission.hooks';
import { getRecursiveTasks } from '../../helpers';

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

  async get(id, params) {
    const svcMissions = this.app.service('missions');

    const userMission = await super.get(id, params);
    assert(userMission, 'user mission not exists.');
    const mission = await svcMissions.get(userMission.mission);
    userMission.tasks = getRecursiveTasks([])(mission.activities);
    return userMission;
  }

  _getTasks(activities) {

  }

  create(data, params) {
    assert(data.mission, 'data.mission not provided.');
    assert(data.access, 'data.access not provided.');
    assert(data.owner, 'data.owner not provided.');
    assert(params.user, 'params.user not provided');

    const svcMissions = this.app.service('missions');
    const getMission = (id) => svcMissions.get(id);

    return getMission(data.mission).then(mission => {
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
    });
  }

  /**
   * Get a list of all available tasks a player can play in a user mission.
   */
  _trigger(id, data, params, orignal) {
    // params = fp.assign({ query: {} }, params);
    // assert(params.user, 'params.user not provided');

    // const svcActions = this.app.service('actions');
    // // get available actions
    // const getActions = () => svcActions.find({
    //   query: { $select: ['rules.rewards.metric', '*'] },
    //   paginate: false
    // });
    // // get user-actions of provided actions
    // const getUserActions = (actions) => {
    //   return super.find({
    //     query: { action: { $in: fp.map(fp.prop('id'), actions) } },
    //     paginate: false
    //   });
    // };

    // // filter actions by requires
    // const fulfillActions = (actions => {
    //   const activeActions = fp.reduce((arr, action) => {
    //     // filter by visibility requirements
    //     if (fulfillActionRequires(action, params.user)) {
    //       // filter by the rule requirements
    //       const rewards = fulfillActionRewards(action, params.user);
    //       action = fp.omit(['rules', 'requires', 'rate'], action);
    //       action.rewards = rewards;
    //       return arr.concat(action);
    //     }
    //     return arr;
    //   }, [], actions);
    //   return activeActions;
    // });

    // // assoc count from user-actions to active actions
    // const assocActions = (actions, userActions) => {
    //   return fp.map(action => {
    //     const userAction = fp.find(fp.propEq('action', action.id), userActions);
    //     return fp.assoc('count', userAction && userAction.count || 0, action);
    //   }, actions);
    // };

    // let activeActions = [];
    // return getActions().then(results => {
    //   activeActions = fulfillActions(results && results.data || results);
    //   return getUserActions(activeActions);
    // }).then(results => {
    //   return assocActions(activeActions, results && results.data || results);
    // });
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
}

export default function init(app, options, hooks) {
  options = Object.assign({ ModelName: 'user-mission' }, options);
  return createService(app, UserMissionService, UserMissionModel, options);
}

init.Service = UserMissionService;
