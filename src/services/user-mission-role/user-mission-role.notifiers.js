import fp from 'mostly-func';
import { helpers } from 'mostly-feathers-mongoose';

import { createActivity, performersNotifications } from '../../helpers';

// change roles mission activity
const rolesMission = (context) => {
  const result = helpers.getHookData(context);
  const actor = context.params.user.id;
  const player = context.id;
  if (result.access === 'PUBLIC') {
    const notifications = performersNotifications(result.performers);
    const custom = {
      actor: `user:${actor}`,
      verb: 'mission.roles',
      message: 'Change roles in the mission',
      roles: context.data.roles,
      player: `user:${player}`
    };
    return [
      createActivity(context, custom),
      `user:${player}`,              // add to player's activity log
      `user:${result.owner}`,        // add to owner's activity log
      `mission:${result.id}`,        // add to mission's activity log
      notifications                  // add to all performers' notification stream
    ];
  } else {
    const custom = {
      actor: `user:${actor}`,
      verb: 'mission.roles.request',
      message: 'Request roles change in the mission',
      role: context.data.roles,
      state: 'PENDING',
      player: `user:${player}`
    };
    return [
      createActivity(context, custom),
      `notification:${result.owner}` // notify owner of the mission to approve requests
    ];
  }
};

export default {
  'mission.roles': rolesMission
};
