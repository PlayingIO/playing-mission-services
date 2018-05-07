import assert from 'assert';
import makeDebug from 'debug';
import { Service, helpers, createService } from 'mostly-feathers-mongoose';
import fp from 'mostly-func';

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
   * Transfer mission ownership to existing performer or any other player
   */
  async transfer (id, data, params) {
    const userMission = params.userMission;
    assert(userMission, 'User mission is not exists.');

    // must be owner of the mission
    if (!fp.idEquals(userMission.owner, data.user)) {
      throw new Error('Only owner of the mission can transfer ownership.');
    }
    if (fp.idEquals(userMission.owner, data.player)) {
      throw new Error('Already owner of the mission.');
    }
    const performer = fp.find(fp.idPropEq('user', data.player), userMission.performers || []);

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
