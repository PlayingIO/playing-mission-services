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
    assert(params.primary, 'User mission id not provided.');

    // Only invitations sent out by current user will be listed.
    const svcFeedsActivities = this.app.service('feeds/activities');
    return svcFeedsActivities.find({
      primary: `user:${params.user.id}`,
      query: {
        verb: 'mission.invite',
        actor: `user:${params.user.id}`,
        object: `userMission:${params.primary}`,
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
      time: new Date().toISOString(),
      mission: `mission-design:${userMission.definition}`,
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
    assert(userMission, 'User mission not exists.');

    // check for pending invitation in notification of current user
    const notification = `notification:${params.user.id}`;
    const activity = await feeds.getPendingActivity(this.app, notification, id);
    if (!activity) {
      throw new Error('No pending invite is found for this invite id.');
    }

    // get values from activity
    const user = helpers.getId(activity.invitee);
    const roles = activity.roles;
    assert(user, 'actor not exists in request activity');
    assert(roles, 'roles not exists in request activity');
    if (!fp.idEquals(user, params.user.id)) {
      throw new Error('invitee is not current user');
    }

    params.locals = { userMission }; // for notifier

    const performer = fp.find(fp.idPropEq('user', user), userMission.performers || []);
    if (!performer) {
      await addUserMissionRoles(this.app, userMission, user, roles);
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
    let userMission = params.primary;
    assert(userMission, 'User mission not exists.');

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
