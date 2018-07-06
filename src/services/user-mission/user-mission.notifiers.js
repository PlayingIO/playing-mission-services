import fp from 'mostly-func';
import { helpers } from 'mostly-feathers-mongoose';

import { createMissionActivity, performersNotifications } from '../../helpers';

// create mission actvitiy
const createMission = (context) => {
  const userMission = helpers.getHookData(context);
  if (!userMission) return;
  const actor = helpers.getCurrentUser(context);
  const notifications = performersNotifications(userMission.performers);
  const custom = {
    actor: `user:${actor}`,
    verb: 'mission.create',
    message: 'Mission was created by ${actor}'
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
  if (!userMission) return;
  const actor = helpers.getCurrentUser(context);
  const notifications = performersNotifications(userMission.performers);
  const custom = {
    actor: `user:${actor}`,
    verb: 'mission.delete',
    message: 'Mission was deleted by ${actor}'
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
  if (!userMission) return;
  const actor = helpers.getCurrentUser(context);
  const newOwner = context.data.player;
  const notifications = performersNotifications(userMission.performers);
  const custom = {
    actor: `user:${actor}`,
    verb: 'mission.transfer',
    message: 'Ownership of the mission has been transfered to ${newOwner}',
    roles: context.data.roles,
    newOwner: `user:${newOwner}`
  };
  return [
    createMissionActivity(context, userMission, custom),
    `user:${actor}`,               // add to old owner's activity log
    `user:${newOwner}`,            // add to new owner's activity log
    `mission:${userMission.id}`,   // add to mission's activity log
    notifications                  // add to all performers' notification stream
  ];
};

export default {
  'mission.create': createMission,
  'mission.delete': deleteMission,
  'mission.transfer': transferMission
};
