const createActivity = async function (app, userMission, verb, message) {
  const svcFeeds = app.service('feeds');

  const activity = {
    actor: `user:${userMission.owner}`,
    verb: verb,
    object: `mission:${userMission.mission}`,
    foreignId: `userMission:${userMission.id}`,
    message: message
  };

  await Promise.all([
    // add to game's actvity log
    svcFeeds.action('addActivity').patch(`game:milkread`, activity),
    // add to player's activity log
    svcFeeds.action('addActivity').patch(`user:${userMission.owner}`, activity),
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
