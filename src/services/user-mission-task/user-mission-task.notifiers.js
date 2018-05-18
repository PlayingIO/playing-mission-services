import fp from 'mostly-func';
import { helpers } from 'mostly-feathers-mongoose';

import { createMissionActivity, performersNotifications } from '../../helpers';

// play mission activity
const playMission = (context) => {
  const { userMission, trigger, activity, rewards } = context.params.locals;
  const actor = context.params.user.id;
  const notifications = performersNotifications(userMission.performers);
  const custom = {
    actor: `user:${actor}`,
    verb: 'mission.play',
    message: 'Play a mission trigger',
    task: trigger,
    activity: activity,
    rewards: rewards
  };
  return [
    createMissionActivity(context, userMission, custom),
    `user:${actor}`,                 // add to player's activity log
    `mission:${userMission.id}`,     // add to mission's activity log
    notifications                    // add to all performers' notification stream
  ];
};

export default {
  'mission.play': playMission
};
