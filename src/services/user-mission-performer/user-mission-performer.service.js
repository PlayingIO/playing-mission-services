import assert from 'assert';
import makeDebug from 'debug';
import fp from 'mostly-func';

import defaultHooks from './user-mission-performer.hooks';

const debug = makeDebug('playing:mission-services:user-missions/performers');

const defaultOptions = {
  name: 'user-missions/performers'
};

export class UserMissionPerformerService {
  constructor (options) {
    this.options = fp.assign(defaultOptions, options);
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
    const userMission = params.userMission;
    assert(userMission, 'User mission not exists.');
    return userMission.performers;
  }

  /**
   * Get the profile of a mission performer
   */
  async get (id, params) {
    const userMission = params.userMission;
    assert(userMission, 'User mission not exists.');
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
    const userMission = params.userMission;
    assert(userMission, 'User mission not exists.');
    assert(userMission.access !== 'PRIVATE', 'The mission is private, cannot join.');

    const performer = fp.find(fp.idPropEq('user', params.user.id), userMission.performers || []);
    if (performer) {
      throw new Error('Performer is already a part of the mission.');
    }

    // process the join for public mission
    const svcUserMissions = this.app.service('user-missions');
    if (userMission.access === 'PUBLIC') {
      return svcUserMissions.patch(userMission.id, {
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
      return userMission;
    }
  }

  /**
   * Leave a mission.
   */
  async remove (id, params) {
    const userMission = params.userMission;
    assert(userMission, 'User mission not exists.');

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
    return svcUserMissions.patch(userMission.id, {
      $pull: {
        'performers': { user: params.user.id }
      }
    }, params);
  }

  /**
   * Kick out a performer from the mission.
   */
  async kick (id, params) {
    const userMission = params.userMission;
    assert(userMission, 'User mission not exists');

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
    return svcUserMissions.patch(userMission.id, {
      $pull: {
        'performers': { user: id }
      }
    }, params);
  }

}

export default function init (app, options, hooks) {
  return new UserMissionPerformerService(options);
}

init.Service = UserMissionPerformerService;
