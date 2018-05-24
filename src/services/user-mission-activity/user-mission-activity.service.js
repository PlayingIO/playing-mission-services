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
    this.options = fp.assignAll(defaultOptions, options);
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
    const userMission = params.primary;
    assert(userMission && userMission.id, 'User mission is not exists');

    const performer = fp.find(fp.idPropEq('user', params.user.id), userMission.performers || []);
    if (!performer) {
      throw new Error('Only performers of the user mission can get the activity feed.');
    }

    const svcFeedsActivities = this.app.service('feeds/activities');
    return svcFeedsActivities.find({
      ...params,
      primary: `mission:${userMission.id}`
    });
  }
}

export default function init (app, options, hooks) {
  return new UserMissionActivityService(options);
}

init.Service = UserMissionActivityService;
