const fp = require('mostly-func');
const { helpers } = require('mostly-feathers-mongoose');

const { createMissionActivity, performersNotifications } = require('../../helpers');

// change roles mission activity
const rolesMission = (context) => {
  const userMission = helpers.getHookData(context);
  const actor = helpers.getCurrentUser(context);
  if (!userMission || !actor) return;

  const player = context.id;
  if (userMission.access === 'PUBLIC') {
    const notifications = performersNotifications(userMission.performers);
    const custom = {
      actor: `user:${actor}`,
      verb: 'mission.roles',
      message: '${actor} has changed roles of the mission',
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
      message: '${actor} requests to change roles of the mission',
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

module.exports = {
  'mission.roles': rolesMission
};
