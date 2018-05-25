import assert from 'assert';
import makeDebug from 'debug';
import fp from 'mostly-func';
import { helpers } from 'mostly-feathers-mongoose';
import { helpers as feeds } from 'playing-feed-services';

import defaultHooks from './user-mission-invite.hooks';
import { addUserMissionRoles } from '../../helpers';

const debug = makeDebug('playing:mission-services:user-missions/invites');

const defaultOptions = {
  name: 'user-missions/invites'
};

export class UserMissionInviteService {
  constructor (options) {
    this.options = fp.assignAll(defaultOptions, options);
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
    const userMission = params.primary;
    assert(userMission && userMission.id, 'User mission is not exists.');

    // Only invitations sent out by current user will be listed.
    const svcFeedsActivities = this.app.service('feeds/activities');
    return svcFeedsActivities.find({
      primary: `user:${params.user.id}`,
      query: {
        verb: 'mission.invite',
        actor: `user:${params.user.id}`,
        object: `userMission:${userMission.id}`,
        state: 'PENDING',
        ...params.query
      }
    });
  }

  /**
   * Invite a player to join a mission
   */
  async create (data, params) {
    const userMission = params.primary;
    assert(userMission && userMission.id, 'User mission is not exists.');
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
      time: new Date().toISOString(),
      definition: `mission-design:${userMission.definition}`,
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
   * Accept an invite
   */
  async patch (id, data, params) {
    let userMission = params.primary;
    assert(userMission && userMission.id, 'User mission is not exists.');

    // check for pending invitation in notification of current user
    const notification = `notification:${params.user.id}`;
    const activity = await feeds.getPendingActivity(this.app, notification, id);
    if (!activity) {
      throw new Error('No pending invite is found for this invite id.');
    }

    // get values from activity
    const invitee = helpers.getId(activity.invitee);
    const roles = activity.roles;
    assert(invitee, 'actor is not exists in request activity');
    assert(roles, 'roles is not exists in request activity');
    if (!fp.idEquals(invitee, params.user.id)) {
      throw new Error('invitee is not current user');
    }

    params.locals = { userMission }; // for notifier

    const performer = fp.find(fp.idPropEq('user', invitee), userMission.performers || []);
    if (!performer) {
      await addUserMissionRoles(this.app, userMission, invitee, roles);
      activity.state = 'ACCEPTED';
      await feeds.updateActivityState(this.app, activity);
      params.locals.activity = activity;
    } else {
      activity.state = 'ALREADY';
      await feeds.updateActivityState(this.app, activity);
      params.locals.activity = activity;
    }

    return activity;
  }

  /**
   * Cancel a pending invite sent out by the current user
   */
  async remove (id, params) {
    // reject intead cancel
    if (params.action === 'reject') {
      return this.reject(id, params);
    }
    // check for pending invitation sent by current user
    const feed = `user:${params.user.id}`;
    const activity = await feeds.getPendingActivity(this.app, feed, id);
    if (!activity) {
      throw new Error('No pending invitation is found for this invite id.');
    }
    // cancel from invitor's feed
    activity.state = 'CANCELED';
    await feeds.updateActivityState(this.app, activity);
    return activity;
  }

  /**
   * Reject an invitation
   */
  async reject (id, params) {
    const userMission = params.primary;
    assert(userMission && userMission.id, 'User mission is not exists.');

    // check for pending invitation in notification of current user
    const notification = `notification:${params.user.id}`;
    const activity = await feeds.getPendingActivity(this.app, notification, id);
    if (!activity) {
      throw new Error('No pending invitation is found for this invite id.');
    }
    // reject from invitee's feed
    activity.state = 'REJECTED';
    await feeds.updateActivityState(this.app, activity);

    params.locals = { userMission, activity }; // for notifier
    
    return activity;
  }
}

export default function init (app, options, hooks) {
  return new UserMissionInviteService(options);
}

init.Service = UserMissionInviteService;
