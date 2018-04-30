import assert from 'assert';
import makeDebug from 'debug';
import fp from 'mostly-func';
import { helpers as metrics } from 'playing-metric-services';
import { helpers as rules } from 'playing-rule-services';
import { helpers as feeds } from 'playing-feed-services';

import defaultHooks from './user-mission-activity.hooks';

const debug = makeDebug('playing:mission-services:user-mission-activities');

const defaultOptions = {
  name: 'user-mission-activities'
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
    const userMission = params.origin;
    assert(userMission, 'User mission not exists.');

    const svcFeeds = this.app.service('feeds');
    return svcFeeds.action('activities').get(`mission:${userMission.id}`, params);
  }
}

export default function init (app, options, hooks) {
  return new UserMissionActivityService(options);
}

init.Service = UserMissionActivityService;
