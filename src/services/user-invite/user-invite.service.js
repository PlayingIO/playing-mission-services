import assert from 'assert';
import makeDebug from 'debug';
import { helpers } from 'mostly-feathers-mongoose';
import fp from 'mostly-func';

import defaultHooks from './user-invite.hooks';

const debug = makeDebug('playing:mission-services:users/invites');

const defaultOptions = {
  name: 'users/invites'
};

export class UserInviteService {
  constructor (options) {
    this.options = fp.assign(defaultOptions, options);
    this.name = this.options.name;
  }

  setup (app) {
    this.app = app;
    this.hooks(defaultHooks(this.options));
  }

  /**
   * List pending invitations to join teams/missions for the player.
   */
  async find (params) {
    const svcFeedsActivities = this.app.service('feeds/activities');
    const invites = ['mission.invite'];
    return svcFeedsActivities.find({
      primary: `notification:${params.user.id}`,
      query: {
        verb: { $in: invites },
        state: 'PENDING',
        ...params.query
      }
    });
  }
}

export default function init (app, options, hooks) {
  return new UserInviteService(options);
}

init.Service = UserInviteService;
