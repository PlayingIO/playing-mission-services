import fp from 'mostly-func';
import { helpers } from 'mostly-feathers-mongoose';
import { helpers as feeds } from 'playing-feed-services';

import { createActivity, performersNotifications } from '../../helpers';

// join mission activity
const joinMission = (context) => {
  const result = helpers.getHookData(context);
  const actor = context.params.user.id;
  if (result.access === 'PUBLIC') {
    const notifications = performersNotifications(result.performers);
    const custom = {
      actor: `user:${actor}`,
      verb: 'mission.join',
      message: 'Join the mission',
      roles: context.data.roles
    };
    return [
      createActivity(context, custom),
      `user:${actor}`,               // add to player's activity log
      `user:${result.owner}`,        // add to owner's activity log
      `mission:${result.id}`,        // add to mission's activity log
      notifications                  // add to all performers' notification stream
    ];
  } else {
    const custom = {
      actor: `user:${actor}`,
      verb: 'mission.join.request',
      message: 'Request joining the mission',
      roles: context.data.roles,
      state: 'PENDING'
    };
    return [
      createActivity(context, custom),
      `notification:${result.owner}` // notify owner of the mission to approve requests
    ];
  }
};

// leave mission activity
const leaveMission = (context) => {
  const result = helpers.getHookData(context);
  const actor = context.params.user.id;
  const notifications = performersNotifications(result.performers);
  const custom = {
    actor: `user:${actor}`,
    verb: 'mission.leave',
    message: 'Leave the mission'
  };
  return [
    createActivity(context, custom),
    `user:${actor}`,                 // add to player's activity log
    `mission:${result.id}`,          // add to mission's activity log
    notifications                    // add to all performers' notification stream
  ];
};

export default {
  'mission.join': joinMission,
  'mission.leave': leaveMission,
};
