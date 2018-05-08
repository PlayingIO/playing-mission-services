import assert from 'assert';
import makeDebug from 'debug';
import fp from 'mostly-func';
import { helpers } from 'mostly-feathers-mongoose';
import { helpers as feeds } from 'playing-feed-services';

import defaultHooks from './user-mission-invite.hooks';
import { getPendingActivity, addUserMissionRoles, updateActivityState } from '../../helpers';

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
    data.message = data.message || 'Invite you to join the mission';

    // must be owner of the mission
    if (!fp.idEquals(userMission.owner, params.user.id)) {
      throw new Error('Only mission owner can send invites.');
    }

    const performer = fp.find(fp.idPropEq('user', data.player), userMission.performers || []);
    if (performer) {
      throw new Error('Requested player is already a part of the mission.');
    }

    // check for pending invitation sent by current user
    const svcFeedsActivities = this.app.service('feeds/activities');
    const invitations = await svcFeedsActivities.find({
      primary: `user:${params.user.id}`,
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
      actor: `user:${params.user.id}`,
      verb: 'mission.invite',
      object: `userMission:${userMission.id}`,
      foreignId: `userMission:${userMission.id}`,
      mission: `mission:${userMission.mission}`,
      message: data.message,
      invitee: `user:${data.player}`,
      roles: data.roles,
      state: 'PENDING'
    };
    return feeds.addActivity(this.app, activity,
      `user:${params.user.id}`,            // add to actor's activity log
      `notification:${data.player}`        // add to invited player's notification stream
    );
  }

  /**
   * Cancel a pending invite sent out by the current user
   */
  async remove (id, params) {
    // check for pending invitation sent
    const svcFeedsActivities = this.app.service('feeds/activities');
    const primary = `user:${params.user.id}`;
    const activity = await getPendingActivity(this.app, primary, id);
    if (!activity || activity.state !== 'PENDING') {
      throw new Error('No pending invitation is found for this invite id.');
    }
    // cancel from invitor's feed
    activity.state = 'CANCELED';
    await updateActivityState(this.app, primary, activity);
    return activity;
  }
}

export default function init (app, options, hooks) {
  return new UserMissionInviteService(options);
}

init.Service = UserMissionInviteService;
