import assert from 'assert';
import makeDebug from 'debug';
import fp from 'mostly-func';

import defaultHooks from './user-mission-activity.hooks';

const debug = makeDebug('playing:mission-services:user-missions/activities');

const defaultOptions = {
  name: 'user-missions/activities'
};

export class UserMissionActivityService {
  constructor (options) {
    this.options = fp.assign(defaultOptions, options);
    this.name = this.options.name;
  }

  setup (app) {
    this.app = app;
    this.hooks(defaultHooks(this.options));
  }

  /**
   * Get a user mission's activity feed
   */
  async find (params) {
    assert(params.primary !== null, 'User mission id not provided.');
    params.primary = `mission:${params.primary}`;
    const svcFeedsActivities = this.app.service('feeds/activities');
    return svcFeedsActivities.find(params);
  }
}

export default function init (app, options, hooks) {
  return new UserMissionActivityService(options);
}

init.Service = UserMissionActivityService;