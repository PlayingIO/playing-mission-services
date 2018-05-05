import assert from 'assert';
import makeDebug from 'debug';
import fp from 'mostly-func';

import defaultHooks from './user-mission-role.hooks';

const debug = makeDebug('playing:mission-services:user-missions/roles');

const defaultOptions = {
  name: 'user-missions/roles'
};

export class UserMissionRoleService {
  constructor (options) {
    this.options = fp.assign(defaultOptions, options);
    this.name = this.options.name;
  }

  setup (app) {
    this.app = app;
    this.hooks(defaultHooks(this.options));
  }

  /**
   * Change own roles or roles of a performer in mission.
   */
  async patch (id, data, params) {
    const userMission = params.userMission;
    assert(userMission, 'User mission not exists.');

    // performer id is not current player, only if current owner of the missions
    if (!fp.idEquals(id, params.user.id) && !fp.idEquals(userMission.owner, params.user.id)) {
      throw new Error('Only owner of the mission can change roles of other player.');
    }

    // whether the id is one of the performers
    const performer = fp.find(fp.idPropEq('user', id), userMission.performers || []);
    if (!performer) {
      throw new Error('Performer id is not members of this mission, please join the mission first.');
    }

    const svcUserMissions = this.app.service('user-missions');

    // process the change if owner or it's a public mission
    if (fp.idEquals(userMission.owner, params.user.id) || userMission.access === 'PUBLIC') {
      // remove a performer from the lane
      params.query = fp.assign(params.query, {
        'performers.user': id
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
      return svcUserMissions.patch(userMission.id, updates, params);
    } else {
      // check for pending roles request sent by current user
      const svcFeedsActivities = this.app.service('feeds/activities');
      const invitations = await svcFeedsActivities.find({
        primary: `notification:${userMission.owner}`,
        $match: {
          actor: `user:${params.user.id}`,
          verb: 'mission.roles.request',
          object: `userMission:${userMission.id}`,
          state: 'PENDING'
        }
      });
      if (fp.isNotEmpty(invitations.data)) {
        throw new Error('An roles change request is already pending for the current user.');
      }

      // send mission.role in notifier
      return userMission;
    }
  }
}

export default function init (app, options, hooks) {
  return new UserMissionRoleService(options);
}

init.Service = UserMissionRoleService;
