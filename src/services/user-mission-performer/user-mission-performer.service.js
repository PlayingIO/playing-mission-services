const assert = require('assert');
const makeDebug = require('debug');
const fp = require('mostly-func');

const defaultHooks = require('./user-mission-performer.hooks');

const debug = makeDebug('playing:mission-services:user-missions/performers');

const defaultOptions = {
  name: 'user-missions/performers'
};

class UserMissionPerformerService {
  constructor (options) {
    this.options = fp.assignAll(defaultOptions, options);
    this.name = this.options.name;
  }

  setup (app) {
    this.app = app;
    this.hooks(defaultHooks(this.options));
  }

  /**
   * List all performers of the user mission
   */
  async find (params) {
    const userMission = params.primary;
    assert(userMission && userMission.id, 'User mission is not exists.');
    return userMission.performers;
  }

  /**
   * Get the profile of a mission performer
   */
  async get (id, params) {
    const userMission = params.primary;
    assert(userMission && userMission.id, 'User mission is not exists.');
    const performer = fp.find(fp.idPropEq('user', id), userMission.performers || []);
    if (performer) {
      return this.app.service('users').get(performer.user, params);
    } else {
      return null;
    }
  }

  /**
   * Join a mission with specified the role and lanes.
   */
  async create (data, params) {
    let userMission = params.primary;
    assert(userMission && userMission.id, 'User mission is not exists.');
    assert(userMission.access !== 'PRIVATE', 'The mission is private, cannot join.');

    const performer = fp.find(fp.idPropEq('user', params.user.id), userMission.performers || []);
    if (performer) {
      throw new Error('Performer is already a part of the mission.');
    }

    // process the join for public mission
    const svcUserMissions = this.app.service('user-missions');
    if (userMission.access === 'PUBLIC') {
      userMission = await svcUserMissions.patch(userMission.id, {
        $addToSet: {
          performers: { user: params.user.id, lanes: data.roles }
        }
      }, params);
    } else {
      // check for pending join request sent by current user
      const svcFeedsActivities = this.app.service('feeds/activities');
      const invitations = await svcFeedsActivities.find({
        primary: `notification:${userMission.owner}`,
        query: {
          actor: `user:${params.user.id}`,
          verb: 'mission.join.request',
          object: `userMission:${userMission.id}`,
          state: 'PENDING'
        }
      });
      if (fp.isNotEmpty(invitations.data)) {
        throw new Error('An join request is already pending for the current user.');
      }
      // send mission.join.request in notifier
    }

    params.locals = { userMission }; // for notifier

    return userMission.performers;
  }

  /**
   * Leave a mission.
   */
  async remove (id, params) {
    let userMission = params.primary;
    assert(userMission && userMission.id, 'User mission is not exists.');

    // kick intead leave
    if (params.action === 'kick') {
      return this.kick(id, params);
    }

    // the owner himself cannot leave
    if (fp.idEquals(userMission.owner, params.user.id)) {
      throw new Error('Owner of the mission cannot leave yourself.');
    }
    const performer = fp.find(fp.idPropEq('user', params.user.id), userMission.performers || []);
    if (!performer) {
      throw new Error('You are not a performer of this mission.');
    }

    const svcUserMissions = this.app.service('user-missions');
    userMission = await svcUserMissions.patch(userMission.id, {
      $pull: {
        'performers': { user: params.user.id }
      }
    }, params);

    params.locals = { userMission }; // for notifier

    return userMission.performers;
  }

  /**
   * Kick out a performer from the mission.
   */
  async kick (id, params) {
    let userMission = params.primary;
    assert(userMission && userMission.id, 'User mission is not exists');

    // must be owner of the mission
    if (!fp.idEquals(userMission.owner, params.user.id)) {
      throw new Error('Only owner of the mission can kick a player.');
    }
    // the owner cannot kicked out himself
    if (fp.idEquals(userMission.owner, id)) {
      throw new Error('Owner of the mission cannot kick yourself.');
    }

    const performer = fp.find(fp.idPropEq('user', id), userMission.performers || []);
    if (!performer) {
      throw new Error('Player is not a member of the mission');
    }

    const svcUserMissions = this.app.service('user-missions');
    userMission = await svcUserMissions.patch(userMission.id, {
      $pull: {
        'performers': { user: id }
      }
    }, params);

    params.locals = { userMission }; // for notifier

    return userMission.performers;
  }

}

module.exports = function init (app, options, hooks) {
  return new UserMissionPerformerService(options);
};
module.exports.Service = UserMissionPerformerService;
