const fp = require('mostly-func');
const { helpers } = require('mostly-feathers-mongoose');

const { createMissionActivity, performersNotifications } = require('../../helpers');

// request accept activity
const acceptMission = (context) => {
  const { userMission, activity } = context.params.locals;
  const actor = helpers.getCurrentUser(context);
  if (!activity || activity.state !== 'ACCEPTED' || !actor) return;

  const player = helpers.getId(activity.actor);
  const notifications = performersNotifications(userMission.performers);
  let custom = {
    actor: `user:${actor}`,
    player: `user:${player}`,
    roles: activity.roles
  };
  if (activity.verb === 'mission.roles.request') {
    custom = {
      verb: 'mission.roles.accept',
      message: 'Roles change request of ${actor} was accepted',
      ...custom
    };
  }
  if (activity.verb === 'mission.join.request') {
    custom = {
      verb: 'mission.join.accept',
      message: 'Join request of ${actor} was accepted',
      ...custom
    };
  }
  return [
    createMissionActivity(context, userMission, custom),
    `user:${player}`,              // add to player's activity log
    `notification:${player}`,      // add to player's notification stream
    `user:${userMission.owner}`,   // add to approver's activity log
    `mission:${userMission.id}`,   // add to mission's activity log
    notifications                  // add to all performers' notification stream
  ];
};

// request reject activity
const rejectMission = (context) => {
  const { userMission, activity } = context.params.locals;
  const actor = helpers.getCurrentUser(context);
  if (!activity || activity.state !== 'REJECTED' || !actor) return;

  const player = helpers.getId(activity.actor);
  let custom = {
    actor: `user:${actor}`,
    player: `user:${player}`,
    roles: activity.roles
  };
  if (activity.verb === 'mission.roles.request') {
    custom = {
      verb: 'mission.roles.reject',
      message: 'Roles change request of ${acotr} was rejected',
      ...custom
    };
  }
  if (activity.verb === 'mission.join.request') {
    custom = {
      verb: 'mission.join.reject',
      message: 'Join request of ${actor} was rejected',
      ...custom
    };
  }
  return [
    createMissionActivity(context, userMission, custom),
    `notification:${player}`,      // add to player's notification stream
    `user:${userMission.owner}`,   // add to rejector's activity log
  ];
};

module.exports = {
  'mission.accept': acceptMission,
  'mission.reject': rejectMission
};
