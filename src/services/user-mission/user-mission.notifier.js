import fp from 'mostly-func';
import { helpers } from 'mostly-feathers-mongoose';
import { helpers as feeds } from 'playing-feed-services';

export default function (event) {
  return context => {
    const createActivity = async function (result, verb, message) {
      const activity = {
        actor: `user:${result.owner}`,
        verb: verb,
        object: `mission:${result.mission}`,
        foreignId: `userMission:${result.id}`,
        message: message
      };

      // notification all other team members/process performers
      const others = fp.without([result.owner],
        fp.map(fp.prop('user'), result.performers || []));
      const actorActivity = others.length > 0
        ? fp.assoc('cc', fp.map(fp.concat('notification:'), others), activity)
        : fp.clone(activity);

      await feeds.addActivity(context.app, activity).feeds(
        `user:${result.owner}`         // add to actor's activity log
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
