import fp from 'mostly-func';
import { helpers } from 'mostly-feathers-mongoose';

import { createMissionActivity, performersNotifications } from '../../helpers';

// create mission actvitiy
const createMission = (context) => {
  const userMission = helpers.getHookData(context);
  const actor = context.params.user.id;
  const notifications = performersNotifications(userMission.performers);
  const custom = {
    actor: `user:${actor}`,
    verb: 'mission.create',
    message: 'Create a mission'
  };
  return [
    createMissionActivity(context, userMission, custom),
    `user:${actor}`,                 // add to player's activity log
    notifications                    // add to all performers' notification stream
  ];
};

// delete mission activity
const deleteMission = (context) => {
  const userMission = helpers.getHookData(context);
  const actor = context.params.user.id;
  const notifications = performersNotifications(userMission.performers);
  const custom = {
    actor: `user:${actor}`,
    verb: 'mission.delete',
    message: 'Delete the mission'
  };
  return [
    createMissionActivity(context, userMission, custom),
    `user:${actor}`,                 // add to player's activity log
    notifications                    // add to all performers' notification stream
  ];
};

// transfer ownership of mission activity
const transferMission = (context) => {
  const userMission = helpers.getHookData(context);
  const actor = context.params.user.id;
  const owner = context.data.player;
  const notifications = performersNotifications(userMission.performers);
  const custom = {
    actor: `user:${actor}`,
    verb: 'mission.transfer',
    message: 'Transfer the ownership of the mission',
    roles: context.data.roles,
    owner: `user:${owner}`
  };
  return [
    createMissionActivity(context, userMission, custom),
    `user:${actor}`,               // add to old owner's activity log
    `user:${owner}`,               // add to new owner's activity log
    `mission:${userMission.id}`,   // add to mission's activity log
    notifications                  // add to all performers' notification stream
  ];
};

export default {
  'mission.create': createMission,
  'mission.remove': deleteMission,
  'mission.transfer': transferMission
};
