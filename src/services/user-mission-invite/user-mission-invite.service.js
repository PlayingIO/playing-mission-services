import assert from 'assert';
import makeDebug from 'debug';
import fp from 'mostly-func';
import { helpers as metrics } from 'playing-metric-services';
import { helpers as rules } from 'playing-rule-services';
import { helpers as feeds } from 'playing-feed-services';

import defaultHooks from './user-mission-invite.hooks';

const debug = makeDebug('playing:mission-services:user-mission-invites');

const defaultOptions = {
  name: 'user-mission-invites'
};

export class UserMissionInviteService {
  constructor (options) {
    this.options = Object.assign({}, defaultOptions, options);
    this.name = this.options.name;
  }

  setup (app) {
    this.app = app;
    this.hooks(defaultHooks(this.options));
  }

  /**
   * List invitations sent out for a mission
   */
  async find (params) {
    assert(params.origin, 'User mission not exists.');

    // Only invitations sent out by current user will be listed.
    const svcFeeds = this.app.service('feeds');
    const invitations = await svcFeeds.action('activities').get(`user:${params.user.id}`, {
      query: {
        verb: 'mission.invite',
        actor: `user:${params.user.id}`,
        object: `userMission:${params.origin.id}`,
        state: 'PENDING'
      }
    });

    return invitations;
  }

  /**
   * Get a user mission's activity feed
   */
  async get (id, params) {
    assert(params.origin, 'User mission not exists.');

    const svcFeeds = this.app.service('feeds');
    return svcFeeds.action('activities').get(`mission:${params.origin.id}`, params);
  }

  /**
   * Invite a player to join a mission
   */
  async create (data, params) {
    assert(params.origin, 'User mission not exists.');
    const userMission = params.origin;

    // must be owner of the mission
    if (!fp.idEquals(userMission.owner, data.user)) {
      throw new Error('Only mission owner can send invites.');
    }

    const performer = fp.find(fp.idPropEq('user', data.player), userMission.performers || []);
    if (performer) {
      throw new Error('Requested player is already a part of the mission.');
    }

    // check for pending invitation sent by current user
    const svcFeeds = this.app.service('feeds');
    const invitations = await svcFeeds.action('activities').get(`user:${data.user}`, {
      query: {
        verb: 'mission.invite',
        object: `userMission:${userMission.id}`,
        invitee: `user:${data.player}`,
        state: 'PENDING'
      }
    });
    if (fp.isNotEmpty(invitations.data)) {
      throw new Error('An invitation is already pending for the requested player.');
    }

    const activity = {
      actor: `user:${data.user}`,
      verb: 'mission.invite',
      object: `userMission:${userMission.id}`,
      foreignId: `userMission:${userMission.id}`,
      mission: `mission:${userMission.mission}`,
      message: 'Invite a player to join the mission',
      invitee: `user:${data.player}`,
      roles: data.roles,
      state: 'PENDING'
    };
    return feeds.addActivity(this.app, activity,
      `user:${data.user}`,                 // add to actor's activity log
      `notification:${data.player}`        // add to invited player's notification stream
    );
  }

  /**
   * Cancel a pending invite sent out by the current user
   */
  async remove (id, data, params, original) {
    assert(params.origin, 'User mission not exists.');

    // check for pending invitation sent
    const svcFeeds = this.app.service('feeds');
    const invitations = await svcFeeds.action('activities').get(`user:${data.user}`, {
      query: {
        id: data.invite,
        state: 'PENDING'
      }
    });
    if (fp.isEmpty(invitations.data)) {
      throw new Error('No pending invitation is found for this invite id.');
    }
    // cancel from invitor's feed
    const invitation = invitations.data[0];
    return svcFeeds.action('updateActivity').patch(`user:${data.user}`, {
      id: invitation.id,
      state: 'CANCELED'
    });
  }
}

export default function init (app, options, hooks) {
  options = Object.assign({ ModelName: 'user-mission-invite' }, options);
  return new UserMissionInviteService(options);
}

init.Service = UserMissionInviteService;
