const assert = require('assert');
const makeDebug = require('debug');
const { Service, createService } = require('mostly-feathers-mongoose');
const fp = require('mostly-func');

const UserMissionModel = require('../../models/user-mission.model');
const defaultHooks = require('./user-mission.hooks');

const debug = makeDebug('playing:mission-services:user-missions');

const defaultOptions = {
  name: 'user-missions',
  actions: {
    activities: 'user-mission-activities',
    invites: 'user-mission-invites'
  }
};

class UserMissionService extends Service {
  constructor (options) {
    options = fp.assignAll(defaultOptions, options);
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
   * Transfer mission ownership to existing performer or any other player
   */
  async transfer (id, data, params) {
    const userMission = params.primary;
    assert(userMission && userMission.id, 'User mission is not exists.');

    // must be owner of the mission
    if (!fp.idEquals(userMission.owner, params.user.id)) {
      throw new Error('Only owner of the mission can transfer ownership.');
    }
    if (fp.idEquals(userMission.owner, data.player)) {
      throw new Error('Already owner of the mission.');
    }
    const performer = fp.find(fp.idPropEq('user', data.player), userMission.performers || []);

    if (!performer) {
      return super.patch(id, {
        owner: data.player,
        $addToSet: {
          performers: {
            user: data.player,
            lanes: data.roles
          }
        }
      }, params);
    } else {
      params.query = fp.assignAll(params.query, {
        'performers.user': data.player
      });
      const updates = fp.reduce((acc, lane) => {
        return fp.assoc(`performers.$.lanes.${lane}`, data.roles[lane]);
      }, {}, fp.keys(data.roles));
      updates.owner = data.player;
      return super.patch(id, updates, params);
    }
  }
}

module.exports = function init (app, options, hooks) {
  options = { ModelName: 'user-mission', ...options };
  return createService(app, UserMissionService, UserMissionModel, options);
};
module.exports.Service = UserMissionService;
