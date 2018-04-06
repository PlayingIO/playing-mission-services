import fp from 'mostly-func';

const createActivity = async function (app, userMission, verb, message) {
  const svcFeeds = app.service('feeds');

  const activity = {
    actor: `user:${userMission.owner}`,
    verb: verb,
    object: `mission:${userMission.mission}`,
    foreignId: `userMission:${userMission.id}`,
    message: message
  };

  // notification all other team members/process performers
  const others = fp.without([userMission.owner],
    fp.map(fp.prop('user'), userMission.performers || []));
  const actorActivity = others.length > 0
    ? fp.assoc('cc', fp.map(fp.concat('notification:'), others), activity)
    : fp.clone(activity);

  await Promise.all([
    // add to game's actvity log
    svcFeeds.action('addActivity').patch(`game:milkread`, activity),
    // add to actor's activity log
    svcFeeds.action('addActivity').patch(`user:${userMission.owner}`, actorActivity),
  ]);
};

// subscribe to mission.create events
export default function (app, options) {
  app.trans.add({
    pubsub$: true,
    topic: 'playing.events',
    cmd: 'mission.create'
  }, (resp) => {
    const userMission = resp.event;
    if (userMission) {
      createActivity(app, userMission, 'mission.create', 'Create a mission');
    }
  });

  app.trans.add({
    pubsub$: true,
    topic: 'playing.events',
    cmd: 'mission.delete'
  }, (resp) => {
    const userMission = resp.event;
    if (userMission) {
      createActivity(app, userMission, 'mission.delete', 'Delete a mission');
    }
  });
}
