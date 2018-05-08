import fp from 'mostly-func';
import { helpers } from 'mostly-feathers-mongoose';

import { createMissionActivity, performersNotifications } from '../../helpers';

// request accept activity
const acceptMission = (context) => {
  const userMission = helpers.getHookData(context);
  const { activity } = context.params.locals;
  const actor = context.params.user.id;
  const player = helpers.getId(activity.actor);
  const notifications = performersNotifications(userMission.performers);
  const custom = {
    actor: `user:${actor}`,
    player: `user:${player}`
  };
  if (activity.verb === 'mission.roles.request') {
    custom.verb = 'mission.roles.accept';
    custom.message = 'Change roles request accept';
    custom.roles = activity.roles;
  }
  if (activity.verb === 'mission.join.request') {
    custom.verb = 'mission.join.accept';
    custom.message = 'Join request accept';
    custom.roles = activity.roles;
  }
  return [
    createMissionActivity(context, userMission, custom),
    `user:${player}`,              // add to player's activity log
    `notification:${player}`,      // add to player's notification stream
    `user:${userMission.owner}`,   // add to approver's activity log
    `mission:${userMission.id}`,   // add to mission's activity log
    notifications                  // add to all performers' notification stream
  ];
};

export default {
  'mission.accept': acceptMission
};
