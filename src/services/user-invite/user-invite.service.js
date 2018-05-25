import assert from 'assert';
import makeDebug from 'debug';
import fp from 'mostly-func';
import { helpers } from 'mostly-feathers-mongoose';
import { helpers as feeds } from 'playing-feed-services';

import defaultHooks from './user-invite.hooks';

const debug = makeDebug('playing:mission-services:users/invites');

const defaultOptions = {
  name: 'users/invites',
  invites: [
    'mission.invite',
    'team.invite'
  ]
};

export class UserInviteService {
  constructor (options) {
    this.options = fp.assignAll(defaultOptions, options);
    this.name = this.options.name;
  }

  setup (app) {
    this.app = app;
    this.hooks(defaultHooks(this.options));
  }

  /**
   * List pending invitations to join teams/missions for current user
   */
  async find (params) {
    const svcFeedsActivities = this.app.service('feeds/activities');
    const invites = this.options.invites;
    return svcFeedsActivities.find({
      primary: `notification:${params.user.id}`,
      query: {
        verb: { $in: invites },
        state: 'PENDING',
        ...params.query
      }
    });
  }

  /**
   * Accept an invite
   */
  async patch (id, data, params) {
    // check for pending invitation in notification of current user
    const notification = `notification:${params.user.id}`;
    const activity = await feeds.getPendingActivity(this.app, notification, id);
    if (!activity) {
      throw new Error('No pending invite is found for this invite id.');
    }
    switch (activity.verb) {
      case 'mission.invite': {
        return this.app.service('user-missions/invites').patch(activity.id, null, {
          primary: helpers.getId(activity.object),
          user: params.user
        });
      }
      default:
        throw new Error(`Unkown activity verb: ${activity.verb}`);
    }
  }

  /**
   * Reject an invite
   */
  async remove (id, params) {
    // check for pending invitation in notification of current user
    const notification = `notification:${params.user.id}`;
    const activity = await feeds.getPendingActivity(this.app, notification, id);
    if (!activity) {
      throw new Error('No pending invite is found for this invite id.');
    }
    switch (activity.verb) {
      case 'mission.invite': {
        return this.app.service('user-missions/invites').remove(activity.id, {
          primary: helpers.getId(activity.object),
          user: params.user,
          action: 'reject'
        });
      }
      default:
        throw new Error(`Unkown activity verb: ${activity.verb}`);
    }
  }
}

export default function init (app, options, hooks) {
  return new UserInviteService(options);
}

init.Service = UserInviteService;
