const assert = require('assert');
const makeDebug = require('debug');
const fp = require('mostly-func');

const defaultHooks = require('./user-mission-role.hooks');
const { updateUserMissionRoles } = require('../../helpers');

const debug = makeDebug('playing:mission-services:user-missions/roles');

const defaultOptions = {
  name: 'user-missions/roles'
};

class UserMissionRoleService {
  constructor (options) {
    this.options = fp.assignAll(defaultOptions, options);
    this.name = this.options.name;
  }

  setup (app) {
    this.app = app;
    this.hooks(defaultHooks(this.options));
  }

  /**
   * Change own roles in mission.
   */
  async patch (id, data, params) {
    const userMission = params.primary;
    assert(userMission && userMission.id, 'User mission is not exists.');

    const isOwner = fp.idEquals(userMission.owner, params.user.id);
    if (!fp.idEquals(id, params.user.id)) { // change roles by owner
      if (!isOwner) {
        throw new Error('Only owner of the mission can change roles of other player.');
      }
    }

    // whether the id is one of the performers
    const performer = fp.find(fp.idPropEq('user', id), userMission.performers || []);
    if (!performer) {
      throw new Error('Not performers of this mission, please join the mission first.');
    }

    // process the change if owner or it's a public mission
    if (isOwner || userMission.access === 'PUBLIC') {
      // update performer's roles
      return updateUserMissionRoles(this.app, userMission, id, data.roles, params);
    } else {
      // check for pending roles request sent by current user
      const svcFeedsActivities = this.app.service('feeds/activities');
      const invitations = await svcFeedsActivities.find({
        primary: `notification:${userMission.owner}`,
        query: {
          actor: `user:${params.user.id}`,
          verb: 'mission.roles.request',
          object: `userMission:${userMission.id}`,
          state: 'PENDING'
        }
      });
      if (fp.isNotEmpty(invitations.data)) {
        throw new Error('An roles change request is already pending for the user.');
      }

      // send mission.role in notifier
      return userMission;
    }
  }
}

module.exports = function init (app, options, hooks) {
  return new UserMissionRoleService(options);
};
module.exports.Service = UserMissionRoleService;
