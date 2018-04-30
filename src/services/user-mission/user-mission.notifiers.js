import fp from 'mostly-func';
import { helpers } from 'mostly-feathers-mongoose';
import { helpers as feeds } from 'playing-feed-services';

import { performersNotifications } from '../../helpers';

const createActivity = (context, custom) => {
  const result = helpers.getHookData(context);
  return {
    actor: `user:${result.owner}`,
    object: `userMission:${result.id}`,
    foreignId: `userMission:${result.id}`,
    mission: `mission:${result.mission}`,
    ...custom
  };
};

// create mission actvitiy
const createMission = (context) => {
  const result = helpers.getHookData(context);
  const actor = context.data.owner;
  const notifications = performersNotifications(result);
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
  const notifications = performersNotifications(result);
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

// join mission activity
const joinMission = (context) => {
  const result = helpers.getHookData(context);
  const actor = context.data.user;
  if (result.access === 'PUBLIC') {
    const notifications = performersNotifications(result);
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
  const actor = context.data.user;
  const notifications = performersNotifications(result);
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

// play mission activity
const playMission = (context) => {
  const result = helpers.getHookData(context);
  const actor = context.data.user;
  const notifications = performersNotifications(result);
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
    const notifications = performersNotifications(result);
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
  const notifications = performersNotifications(result);
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

export default function (context) {
  return {
    'mission.create': createMission(context),
    'mission.remove': deleteMission(context),
    'mission.join': joinMission(context),
    'mission.leave': leaveMission(context),
    'mission.play': playMission(context),
    'mission.roles': rolesMission(context),
    'mission.transfer': transferMission(context)
  };
}
