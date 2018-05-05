import fp from 'mostly-func';
import { helpers } from 'mostly-feathers-mongoose';
import { helpers as feeds } from 'playing-feed-services';

import { createActivity, performersNotifications } from '../../helpers';

// create mission actvitiy
const createMission = (context) => {
  const result = helpers.getHookData(context);
  const actor = context.data.owner;
  const notifications = performersNotifications(result.performers);
  const custom = {
    actor: `user:${actor}`,
    verb: 'mission.create',
    message: 'Create a mission'
  };
  return [
    createActivity(context, custom),
    `user:${actor}`,                 // add to player's activity log
    notifications                    // add to all performers' notification stream
  ];
};

// delete mission activity
const deleteMission = (context) => {
  const result = helpers.getHookData(context);
  const actor = context.data.owner;
  const notifications = performersNotifications(result.performers);
  const custom = {
    actor: `user:${actor}`,
    verb: 'mission.delete',
    message: 'Delete the mission'
  };
  return [
    createActivity(context, custom),
    `user:${actor}`,                 // add to player's activity log
    notifications                    // add to all performers' notification stream
  ];
};

// play mission activity
const playMission = (context) => {
  const result = helpers.getHookData(context);
  const actor = context.data.user;
  const notifications = performersNotifications(result.performers);
  const custom = {
    actor: `user:${actor}`,
    verb: 'mission.leave',
    message: 'Play a mission trigger',
    task: result.currentTask,
    rewards: result.currentRewards
  };
  return [
    createActivity(context, custom),
    `user:${actor}`,                 // add to player's activity log
    `mission:${result.id}`,          // add to mission's activity log
    notifications                    // add to all performers' notification stream
  ];
};

// change roles mission activity
const rolesMission = (context) => {
  const result = helpers.getHookData(context);
  const actor = context.data.user;
  const player = context.data.player || context.data.user;
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

// transfer ownership of mission activity
const transferMission = (context) => {
  const result = helpers.getHookData(context);
  const actor = context.data.user;
  const owner = context.data.player;
  const notifications = performersNotifications(result.performers);
  const custom = {
    actor: `user:${actor}`,
    verb: 'mission.transfer',
    message: 'Transfer the ownership of the mission',
    roles: context.data.roles,
    owner: `user:${owner}`
  };
  return [
    createActivity(context, custom),
    `user:${actor}`,               // add to old owner's activity log
    `user:${owner}`,               // add to new owner's activity log
    `mission:${result.id}`,        // add to mission's activity log
    notifications                  // add to all performers' notification stream
  ];
};

export default {
  'mission.create': createMission,
  'mission.remove': deleteMission,
  'mission.play': playMission,
  'mission.roles': rolesMission,
  'mission.transfer': transferMission
};
