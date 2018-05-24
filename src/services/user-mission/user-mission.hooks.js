import { iff, isProvider } from 'feathers-hooks-common';
import { associateCurrentUser, queryWithCurrentUser } from 'feathers-authentication-hooks';
import { hooks } from 'mostly-feathers-mongoose';
import { cache } from 'mostly-feathers-cache';
import { sanitize, validate } from 'mostly-feathers-validate';
import { hooks as feeds } from 'playing-feed-services';

import UserMissionEntity from '../../entities/user-mission.entity';
import notifiers from './user-mission.notifiers';
import accepts from './user-mission.accepts';

export default function (options = {}) {
  return {
    before: {
      all: [
        hooks.authenticate('jwt', options.auth),
        cache(options.cache)
      ],
      create: [
        iff(isProvider('external'),
          associateCurrentUser({ idField: 'id', as: 'owner' })),
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
}