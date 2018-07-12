const { hooks } = require('mostly-feathers-mongoose');
const { cache } = require('mostly-feathers-cache');
const { sanitize, validate } = require('mostly-feathers-validate');
const feeds = require('playing-feed-common');

const accepts = require('./user-mission-task.accepts');
const notifiers = require('./user-mission-task.notifiers');

module.exports = function (options = {}) {
  return {
    before: {
      all: [
        hooks.authenticate('jwt', options.auth, 'scores,actions'),
        cache(options.cache)
      ],
      find: [
        hooks.addRouteObject('primary', { service: 'user-missions',
          select: 'mission.activities.requires,mission.activities.rewards,*' }),
      ],
      create: [
        hooks.addRouteObject('primary', { service: 'user-missions',
          select: 'mission.activities.requires,mission.activities.rewards,*' }),
        sanitize(accepts),
        validate(accepts)
      ]
    },
    after: {
      all: [
        cache(options.cache),
        hooks.responder()
      ],
      create: [
        feeds.notify('mission.play', notifiers),
      ]
    }
  };
};