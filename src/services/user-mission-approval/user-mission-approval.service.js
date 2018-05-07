import assert from 'assert';
import makeDebug from 'debug';
import { helpers } from 'mostly-feathers-mongoose';
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
      query: {
        verb: { $in: ['mission.join.request', 'mission.roles.request'] },
        object: `userMission:${userMission.id}`,
        state: 'PENDING'
      }
    });

    return invitations;
  }

  /**
   * Approve mission join or role change request
   */
  async patch (id, data, params) {
    const userMission = params.userMission;
    assert(userMission, 'User mission not exists.');

    // must be owner of the mission
    if (!fp.idEquals(userMission.owner, params.user.id)) {
      throw new Error('Only owner of the mission can approval the request.');
    }

    // check for pending requests
    const svcFeedsActivities = this.app.service('feeds/activities');
    const notification = `notification:${params.user.id}`;
    const requests = await svcFeedsActivities.find({
      primary: notification,
      query: { _id: id }
    });
    if (fp.isEmpty(requests.data) || requests.data[0].state !== 'PENDING') {
      throw new Error('No pending request is found for this request id.');
    }

    const activity = requests.data[0];
    if (activity.verb === 'mission.join.request') {
      const user = helpers.getId(activity.actor);
      const roles = activity.roles;
      await this.join(userMission.id, { user, roles }, {}, userMission);
    }
    if (activity.verb === 'mission.roles.request') {
      const user = helpers.getId(activity.actor);
      const roles = activity.roles;
      await this.roles(userMission.id, { user, roles }, {}, userMission);
    }
    await svcFeedsActivities.patch(activity.id, {
      state: 'ACCEPTED'
    }, {
      primary: notification
    });

    return userMission;
  }

}

export default function init (app, options, hooks) {
  return new UserMissionApprovalService(options);
}

init.Service = UserMissionApprovalService;
