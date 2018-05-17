import fp from 'mostly-func';
import { helpers } from 'mostly-feathers-mongoose';

import { createMissionActivity, performersNotifications } from '../../helpers';

// request accept activity
const acceptMission = (context) => {
  const { userMission, activity } = context.params.locals;
  if (!activity || activity.state !== 'ACCEPTED') return [];

  const actor = context.params.user.id;
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
      message: 'Change roles request accept',
      ...custom
    };
  }
  if (activity.verb === 'mission.join.request') {
    custom = {
      verb: 'mission.join.accept',
      message: 'Join request accept',
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
  if (!activity || activity.state !== 'REJECTED') return [];

  const actor = context.params.user.id;
  const player = helpers.getId(activity.actor);
  let custom = {
    actor: `user:${actor}`,
    player: `user:${player}`,
    roles: activity.roles
  };
  if (activity.verb === 'mission.roles.request') {
    custom = {
      verb: 'mission.roles.reject',
      message: 'Change roles request reject',
      ...custom
    };
  }
  if (activity.verb === 'mission.join.request') {
    custom = {
      verb: 'mission.join.reject',
      message: 'Join request reject',
      ...custom
    };
  }
  return [
    createMissionActivity(context, userMission, custom),
    `notification:${player}`,      // add to player's notification stream
    `user:${userMission.owner}`,   // add to rejector's activity log
  ];
};

export default {
  'mission.accept': acceptMission,
  'mission.reject': rejectMission
};
