import { iff, isProvider } from 'feathers-hooks-common';
import { associateCurrentUser, queryWithCurrentUser } from 'feathers-authentication-hooks';
import { hooks } from 'mostly-feathers-mongoose';
import { cache } from 'mostly-feathers-cache';
import { sanitize, validate } from 'mostly-feathers-validate';
import { entities as feeds } from 'playing-feed-services';

import notifier from './user-mission-invite.notifier';
import accepts from './user-mission-invite.accepts';

export default function (options = {}) {
  return {
    before: {
      all: [
        hooks.authenticate('jwt', options.auth, 'scores,actions'),
        cache(options.cache)
      ],
      create: [
        iff(isProvider('external'),
          associateCurrentUser({ idField: 'id', as: 'user' })),
        sanitize(accepts),
        validate(accepts),
      ],
      update: [
        iff(isProvider('external'),
          associateCurrentUser({ idField: 'id', as: 'user' })),
        sanitize(accepts),
        validate(accepts),
        hooks.discardFields('owner', 'createdAt', 'updatedAt', 'destroyedAt')
      ],
      patch: [
        iff(isProvider('external'),
          associateCurrentUser({ idField: 'id', as: 'user' })),
        sanitize(accepts),
        validate(accepts),
        hooks.discardFields('owner', 'createdAt', 'updatedAt', 'destroyedAt')
      ]
    },
    after: {
      all: [
        hooks.populate('actor', { retained: false }),
        hooks.populate('mission', { retained: false }),
        hooks.populate('object', { retained: false }),
        hooks.populate('target', { retained: false }),
        cache(options.cache),
        hooks.presentEntity(feeds.activity, options.entities),
        hooks.responder()
      ],
      create: [
        notifier('mission.create')
      ],
      patch: [
        iff(hooks.isAction('invite'), notifier('mission.invite')),
        iff(hooks.isAction('join'), notifier('mission.join')),
        iff(hooks.isAction('leave'), notifier('mission.leave')),
        iff(hooks.isAction('play'), notifier('mission.play')),
        iff(hooks.isAction('roles'), notifier('mission.roles')),
        iff(hooks.isAction('transfer'), notifier('mission.transfer'))
      ],
      remove: [
        notifier('mission.delete')
      ]
    }
  };
}