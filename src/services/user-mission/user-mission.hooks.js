import { iff, isProvider } from 'feathers-hooks-common';
import { associateCurrentUser, queryWithCurrentUser } from 'feathers-authentication-hooks';
import { hooks } from 'mostly-feathers-mongoose';
import { cache } from 'mostly-feathers-cache';
import { sanitize, validate } from 'mostly-feathers-validate';
import { hooks as feeds, entities as feedsEntities } from 'playing-feed-services';

import UserMissionEntity from '../../entities/user-mission.entity';
import notifiers from './user-mission.notifiers';
import accepts from './user-mission.accepts';

export default function (options = {}) {
  return {
    before: {
      all: [
        iff(hooks.isAction('play'),
          hooks.authenticate('jwt', options.auth, 'scores,actions')
        ).else(
          hooks.authenticate('jwt', options.auth)
        ),
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
        iff(isProvider('external'),
          associateCurrentUser({ idField: 'id', as: 'user' })),
        sanitize(accepts),
        validate(accepts),
        hooks.discardFields('owner', 'tasks', 'createdAt', 'updatedAt', 'destroyedAt')
      ],
      patch: [
        iff(isProvider('external'),
          associateCurrentUser({ idField: 'id', as: 'user' })),
        iff(hooks.isAction('transfer'),
          hooks.primaryResource('userMission', { service: 'user-missions', field: 'id' })),
        sanitize(accepts),
        validate(accepts),
        hooks.discardFields('owner', 'tasks', 'createdAt', 'updatedAt', 'destroyedAt')
      ]
    },
    after: {
      all: [
        iff(hooks.isAction('approvals'),
          hooks.populate('actor', { retained: false }),
          hooks.populate('mission', { retained: false }),
          hooks.populate('object', { retained: false }),
          hooks.populate('target', { retained: false })
        ).else(
          hooks.populate('mission', { service: 'missions' }),
          hooks.populate('owner', { service: 'users' }),
          hooks.populate('performers.user', { service: 'users' })
        ),
        cache(options.cache),
        iff(hooks.isAction('approvals'),
          hooks.presentEntity(feedsEntities.activity, options.entities))
        .else(
          hooks.presentEntity(UserMissionEntity, options.entities)
        ),
        hooks.responder()
      ],
      create: [
        iff(hooks.isAction('create', feeds.notify('mission.create', notifiers)))
      ],
      patch: [
        iff(hooks.isAction('play'), feeds.notify('mission.play', notifiers)),
        iff(hooks.isAction('transfer'), feeds.notify('mission.transfer', notifiers))
      ],
      remove: [
        iff(hooks.isAction('create', feeds.notify('mission.delete')))
      ]
    }
  };
}