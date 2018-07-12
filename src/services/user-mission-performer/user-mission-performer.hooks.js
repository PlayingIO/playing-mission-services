const { iff } = require('feathers-hooks-common');
const { hooks } = require('mostly-feathers-mongoose');
const { cache } = require('mostly-feathers-cache');
const { sanitize, validate } = require('mostly-feathers-validate');
const feeds = require('playing-feed-common');

const accepts = require('./user-mission-performer.accepts');
const notifiers = require('./user-mission-performer.notifiers');

module.exports = function (options = {}) {
  return {
    before: {
      all: [
        hooks.authenticate('jwt', options.auth),
        cache(options.cache)
      ],
      find: [
        hooks.addRouteObject('primary', { service: 'user-missions' }),
      ],
      get: [
        hooks.addRouteObject('primary', { service: 'user-missions' }),
      ],
      create: [
        hooks.addRouteObject('primary', { service: 'user-missions' }),
        sanitize(accepts),
        validate(accepts)
      ],
      remove: [
        hooks.addRouteObject('primary', { service: 'user-missions' }),
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
        feeds.notify('mission.join', notifiers)
      ],
      remove: [
        iff(hooks.isAction('kick'),
          feeds.notify('mission.kick', notifiers))
        .else(
          feeds.notify('mission.leave', notifiers)
        )
      ]
    }
  };
};