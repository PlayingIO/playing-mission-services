import assert from 'assert';
import makeDebug from 'debug';
import { helpers } from 'mostly-feathers-mongoose';
import fp from 'mostly-func';

import defaultHooks from './user-approval.hooks';

const debug = makeDebug('playing:mission-services:users/approvals');

const defaultOptions = {
  name: 'users/approvals'
};

export class UserApprovalService {
  constructor (options) {
    this.options = fp.assign(defaultOptions, options);
    this.name = this.options.name;
  }

  setup (app) {
    this.app = app;
    this.hooks(defaultHooks(this.options));
  }

  /**
   * List pending pending approvals to join teams/missions for the player
   */
  async find (params) {
    const svcFeedsActivities = this.app.service('feeds/activities');
    const requests = ['mission.join.request', 'mission.roles.request'];
    return svcFeedsActivities.find({
      primary: `user:${params.user.id}`,
      query: {
        verb: { $in: requests },
        state: 'PENDING',
        ...params.query
      }
    });
  }
}

export default function init (app, options, hooks) {
  return new UserApprovalService(options);
}

init.Service = UserApprovalService;
