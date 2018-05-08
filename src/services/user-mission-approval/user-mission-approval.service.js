import assert from 'assert';
import makeDebug from 'debug';
import { helpers } from 'mostly-feathers-mongoose';
import fp from 'mostly-func';

import defaultHooks from './user-mission-approval.hooks';
import { updateActivityState, updateUserMissionRoles } from '../../helpers';

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
    let userMission = params.userMission;
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

    // get values from activity
    const activity = requests.data[0];
    const user = helpers.getId(activity.actor);
    const roles = activity.roles;
    assert(user, 'actor not exists in request activity');
    assert(roles, 'roles not exists in request activity');

    params.locals = { userMission }; // for notifier
    switch (activity.verb) {
      case 'mission.join.request': {
        const performer = fp.find(fp.idPropEq('user', user), userMission.performers || []);
        if (!performer) {
          const svcUserMissions = this.app.service('user-missions');
          userMission = await svcUserMissions.patch(userMission.id, {
            $addToSet: {
              performers: { user: user, lanes: roles }
            }
          });
          activity.state = 'ACCEPTED';
          await updateActivityState(this.app, notification, activity);
          params.locals.activity = activity;
        }
        break;
      }
      case 'mission.roles.request': {
        userMission = await updateUserMissionRoles(this.app, userMission, user, roles);
        activity.state = 'ACCEPTED';
        await updateActivityState(this.app, notification, activity);
        params.locals.activity = activity;
        break;
      }
      default:
        throw new Error(`Unkown activity verb: ${activity.verb}`);
    }

    return activity;
  }

}

export default function init (app, options, hooks) {
  return new UserMissionApprovalService(options);
}

init.Service = UserMissionApprovalService;
