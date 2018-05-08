import fp from 'mostly-func';
import { helpers } from 'mostly-feathers-mongoose';

import { createMissionActivity, performersNotifications } from '../../helpers';

// request accept activity
const acceptMission = (context) => {
  const userMission = helpers.getHookData(context);
  const { activity } = context.params.locals;
  const actor = context.params.user.id;
  const player = helpers.getId(activity.player);
  if (activity.verb === 'mission.roles.request') {
    const notifications = performersNotifications(userMission.performers);
    const custom = {
      actor: `user:${actor}`,
      verb: 'mission.roles.accept',
      message: 'Change roles request accept',
      roles: activity.roles,
      player: `user:${player}`
    };
    return [
      createMissionActivity(context, userMission, custom),
      `user:${player}`,              // add to player's activity log
      `notification:${player}`,      // add to player's notification stream
      `user:${userMission.owner}`,   // add to approver's activity log
      notifications                  // add to all performers' notification stream
    ];
  }
};

export default {
  'mission.accept': acceptMission
};
