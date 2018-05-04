import assert from 'assert';
import makeDebug from 'debug';
import fp from 'mostly-func';
import { helpers as feeds } from 'playing-feed-services';

import defaultHooks from './user-mission-invite.hooks';

const debug = makeDebug('playing:mission-services:user-missions/invites');

const defaultOptions = {
  name: 'user-missions/invites'
};

export class UserMissionInviteService {
  constructor (options) {
    this.options = fp.assign(defaultOptions, options);
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
    assert(params.primary, 'User mission id not provided.');

    // Only invitations sent out by current user will be listed.
    const svcFeedsActivities = this.app.service('feeds/activities');
    const invitations = await svcFeedsActivities.find({
      primary: `user:${params.user.id}`,
      query: {
        verb: 'mission.invite',
        actor: `user:${params.user.id}`,
        object: `userMission:${params.primary}`,
        state: 'PENDING'
      }
    });

    return invitations;
  }

  /**
   * Invite a player to join a mission
   */
  async create (data, params) {
    const userMission = params.userMission;
    assert(userMission, 'User mission not exists.');

    // must be owner of the mission
    if (!fp.idEquals(userMission.owner, data.user)) {
      throw new Error('Only mission owner can send invites.');
    }

    const performer = fp.find(fp.idPropEq('user', data.player), userMission.performers || []);
    if (performer) {
      throw new Error('Requested player is already a part of the mission.');
    }

    // check for pending invitation sent by current user
    const svcFeedsActivities = this.app.service('feeds/activities');
    const invitations = await svcFeedsActivities.find({
      primary: `user:${data.user}`,
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

    // create mission invite activity
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
  async remove (id, params) {
    // check for pending invitation sent
    const svcFeedsActivities = this.app.service('feeds/activities');
    const invitations = await svcFeedsActivities.find({
      primary: `user:${params.user.id}`,
      query: { id, state: 'PENDING' }
    });
    if (fp.isEmpty(invitations.data)) {
      throw new Error('No pending invitation is found for this invite id.');
    }
    // cancel from invitor's feed
    const invitation = invitations.data[0];
    return svcFeedsActivities.action('updateActivity').patch(`user:${params.user.id}`, {
      id: invitation.id,
      state: 'CANCELED'
    });
  }
}

export default function init (app, options, hooks) {
  return new UserMissionInviteService(options);
}

init.Service = UserMissionInviteService;
