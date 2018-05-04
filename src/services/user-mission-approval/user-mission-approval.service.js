import assert from 'assert';
import makeDebug from 'debug';
import fp from 'mostly-func';

import defaultHooks from './user-mission-approval.hooks';

const debug = makeDebug('playing:mission-services:user-missions/approvals');

const defaultOptions = {
  name: 'user-missions/approvals'
};

export class UserMissionApprovalService {
  constructor (options) {
    this.options = fp.assign(defaultOptions, options);
    this.name = this.options.name;
  }

  setup (app) {
    this.app = app;
    this.hooks(defaultHooks(this.options));
  }

  /**
   * List pending mission join or role change requests
   */
  async find (params) {
    const userMission = params.userMission;
    assert(userMission, 'User mission not exists.');

    // must be owner of the mission
    if (!fp.idEquals(userMission.owner, params.user.id)) {
      throw new Error('Only mission owner can list pending requests.');
    }

    // check for pending invitation
    const svcFeedsActivities = this.app.service('feeds/activities');
    const invitations = await svcFeedsActivities.find({
      primary: `notification:${userMission.owner}`,
      $match: {
        verb: { $in: ['mission.join.request', 'mission.roles.request'] },
        object: `userMission:${userMission.id}`,
        state: 'PENDING'
      }
    });

    return invitations;
  }

}

export default function init (app, options, hooks) {
  return new UserMissionApprovalService(options);
}

init.Service = UserMissionApprovalService;
