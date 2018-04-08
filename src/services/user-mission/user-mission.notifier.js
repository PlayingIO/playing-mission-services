import fp from 'mostly-func';
import { helpers } from 'mostly-feathers-mongoose';
import { helpers as feeds } from 'playing-feed-services';

export default function (event) {
  return context => {
    const createActivity = async function (userMission, verb, message) {
      const activity = {
        actor: `user:${userMission.owner}`,
        verb: verb,
        object: `mission:${userMission.mission}`,
        foreignId: `userMission:${userMission.id}`,
        message: message
      };

      // notification all other mission performers
      const others = fp.without([userMission.owner],
        fp.map(fp.prop('user'), userMission.performers || []));
      const notifications = fp.map(fp.concat('notification:'), others);

      await feeds.addActivity(context.app, activity).feeds(
        `user:${userMission.owner}`,     // add to actor's activity log
        notifications                    // add to performers' notification stream
      );
    };

    const result = helpers.getHookData(context);
    switch (event) {
      case 'mission.create':
        createActivity(result, event, 'Create a mission');
        break;
      case 'mission.delete':
        createActivity(result, event, 'Delete a mission');
        break;
    }
  };
}
