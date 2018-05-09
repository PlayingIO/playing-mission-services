import fp from 'mostly-func';
import { helpers } from 'mostly-feathers-mongoose';

import { createMissionActivity, performersNotifications } from '../../helpers';

// change roles mission activity
const rolesMission = (context) => {
  const userMission = helpers.getHookData(context);
  const actor = context.params.user.id;
  const player = context.id;
  if (userMission.access === 'PUBLIC') {
    const notifications = performersNotifications(userMission.performers);
    const custom = {
      actor: `user:${actor}`,
      verb: 'mission.roles',
      message: 'Change roles in the mission',
      roles: context.data.roles,
      player: `user:${player}`
    };
    return [
      createMissionActivity(context, userMission, custom),
      `user:${player}`,              // add to player's activity log
      `user:${userMission.owner}`,   // add to owner's activity log
      `mission:${userMission.id}`,   // add to mission's activity log
      notifications                  // add to all performers' notification stream
    ];
  } else {
    const custom = {
      actor: `user:${actor}`,
      verb: 'mission.roles.request',
      message: 'Request roles change in the mission',
      roles: context.data.roles,
      state: 'PENDING',
      player: `user:${player}`
    };
    return [
      createMissionActivity(context, userMission, custom),
      `user:${actor}`,                    // add to player's activity log
      `notification:${userMission.owner}` // notify owner of the mission to approve requests
    ];
  }
};

export default {
  'mission.roles': rolesMission
};
