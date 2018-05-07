import fp from 'mostly-func';
import { helpers } from 'mostly-feathers-mongoose';

import { createMissionActivity, performersNotifications } from '../../helpers';

// join mission activity
const joinMission = (context) => {
  const userMission = helpers.getHookData(context);
  const actor = context.params.user.id;
  if (userMission.access === 'PUBLIC') {
    const notifications = performersNotifications(userMission.performers);
    const custom = {
      actor: `user:${actor}`,
      verb: 'mission.join',
      message: 'Join the mission',
      roles: context.data.roles
    };
    return [
      createMissionActivity(context, userMission, custom),
      `user:${actor}`,               // add to player's activity log
      `user:${userMission.owner}`,   // add to owner's activity log
      `mission:${userMission.id}`,   // add to mission's activity log
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
      createMissionActivity(context, userMission, custom),
      `notification:${userMission.owner}` // notify owner of the mission to approve requests
    ];
  }
};

// leave mission activity
const leaveMission = (context) => {
  const userMission = helpers.getHookData(context);
  const actor = context.params.user.id;
  const notifications = performersNotifications(userMission.performers);
  const custom = {
    actor: `user:${actor}`,
    verb: 'mission.leave',
    message: 'Leave the mission'
  };
  return [
    createMissionActivity(context, userMission, custom),
    `user:${actor}`,                 // add to player's activity log
    `mission:${userMission.id}`,     // add to mission's activity log
    notifications                    // add to all performers' notification stream
  ];
};

// kick from mission activity
const kickMission = (context) => {
  const userMission = helpers.getHookData(context);
  const actor = context.params.user.id;
  const player = context.id;
  const notifications = performersNotifications(userMission.performers);
  const custom = {
    actor: `user:${actor}`,
    verb: 'mission.kick',
    message: 'Join the mission',
    roles: context.data.roles
  };
  return [
    createMissionActivity(context, userMission, custom),
    `user:${player}`,              // add to kicked player's activity log
    `notification:${player}`,      // add to kicked player's notification stream
    `mission:${userMission.id}`,   // add to mission's activity log
    notifications                  // add to all performers' notification stream
  ];
};

export default {
  'mission.join': joinMission,
  'mission.leave': leaveMission,
  'mission.kick': kickMission,
};
