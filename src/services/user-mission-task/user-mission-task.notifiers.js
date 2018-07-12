const fp = require('mostly-func');
const { helpers } = require('mostly-feathers-mongoose');

const { createMissionActivity, performersNotifications } = require('../../helpers');

// play mission activity
const playMission = (context) => {
  const { userMission, trigger, activity, rewards } = context.params.locals;
  const actor = helpers.getCurrentUser(context);
  if (!userMission || !actor) return;

  const notifications = performersNotifications(userMission.performers);
  const custom = {
    actor: `user:${actor}`,
    verb: 'mission.play',
    message: '${actor} has played ${trigger}',
    trigger: trigger,
    task: fp.omit(['performers', 'rewards'], trigger),
    activity: fp.omit(['rate', 'notify', 'requires', 'rewards'], activity),
    rewards: rewards
  };
  return [
    createMissionActivity(context, userMission, custom),
    `user:${actor}`,                 // add to player's activity log
    `mission:${userMission.id}`,     // add to mission's activity log
    notifications                    // add to all performers' notification stream
  ];
};

module.exports = {
  'mission.play': playMission
};
