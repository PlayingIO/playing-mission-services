const { iff } = require('feathers-hooks-common');
const { associateCurrentUser, queryWithCurrentUser } = require('feathers-authentication-hooks');
const { hooks } = require('mostly-feathers-mongoose');
const { cache } = require('mostly-feathers-cache');
const { sanitize, validate } = require('mostly-feathers-validate');
const feeds = require('playing-feed-common');

const UserMissionEntity = require('../../entities/user-mission.entity');
const notifiers = require('./user-mission.notifiers');
const accepts = require('./user-mission.accepts');

module.exports = function (options = {}) {
  return {
    before: {
      all: [
        hooks.authenticate('jwt', options.auth),
        cache(options.cache)
      ],
      create: [
        associateCurrentUser({ idField: 'id', as: 'owner' }),
        sanitize(accepts),
        validate(accepts),
        hooks.discardFields('tasks')
      ],
      update: [
        sanitize(accepts),
        validate(accepts),
        hooks.discardFields('owner', 'tasks', 'createdAt', 'updatedAt', 'destroyedAt')
      ],
      patch: [
        iff(hooks.isAction('transfer'),
          hooks.addRouteObject('primary', { service: 'user-missions', field: 'id' })),
        sanitize(accepts),
        validate(accepts),
        hooks.discardFields('owner', 'tasks', 'createdAt', 'updatedAt', 'destroyedAt')
      ]
    },
    after: {
      all: [
        hooks.populate('definition', { service: 'mission-designs' }),
        hooks.populate('owner', { service: 'users' }),
        hooks.populate('performers.user', { service: 'users' }),
        cache(options.cache),
        hooks.presentEntity(UserMissionEntity, options.entities),
        hooks.responder()
      ],
      create: [
        feeds.notify('mission.create', notifiers)
      ],
      patch: [
        iff(hooks.isAction('transfer'), feeds.notify('mission.transfer', notifiers))
      ],
      remove: [
        feeds.notify('mission.delete', notifiers)
      ]
    }
  };
};