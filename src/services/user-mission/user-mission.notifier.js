import fp from 'mostly-func';
import { helpers } from 'mostly-feathers-mongoose';
import { helpers as feeds } from 'playing-feed-services';

export default function (event) {
  return context => {
    const createActivity = async function (userMission, verb, message, ...targets) {
      const activity = {
        actor: `user:${userMission.owner}`,
        verb: verb,
        object: `mission:${userMission.mission}`,
        foreignId: `userMission:${userMission.id}`,
        message: message
      };

      await feeds.addActivity(context.app, activity).feeds(targets);
    };

    const performersNotifications = function (userMission) {
      return fp.map(fp.pipe(
        fp.prop('user'),
        fp.toString,
        fp.concat('notification:')
      ), userMission.performers || []);
    };

    const result = helpers.getHookData(context);
    switch (event) {
      case 'mission.create': {
        const notifications = performersNotifications(result);
        createActivity(result, event, 'Create a mission',
          `user:${result.owner}`,         // add to owner's activity log
          notifications                   // add to performers' notification stream
        );
        break;
      }
      case 'mission.join':
        if (result.access === 'public') {
          const player = context.data.player || context.data.user;
          const notifications = performersNotifications(result, player);
          createActivity(result, event, 'Join a mission',
            `user:${player}`,             // add to performer's activity log
            `user:${result.owner}`,       // add to owner's activity log
            `userMission:${result.id}`,   // add to mission's activity log
            notifications                 // add to performers' notification stream
          );
        } else {
          createActivity(result, event + '.request', 'Join request a mission');
        }
        break;
      case 'mission.delete': {
        const notifications = performersNotifications(result);
        createActivity(result, event, 'Delete a mission',
          `user:${result.owner}`,       // add to owner's activity log
          notifications                 // add to performers' notification stream
        );
        break;
      }
    }
  };
}
