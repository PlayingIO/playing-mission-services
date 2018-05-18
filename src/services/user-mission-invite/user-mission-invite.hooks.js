import { iff, isProvider } from 'feathers-hooks-common';
import { associateCurrentUser, queryWithCurrentUser } from 'feathers-authentication-hooks';
import { hooks } from 'mostly-feathers-mongoose';
import { cache } from 'mostly-feathers-cache';
import { sanitize, validate } from 'mostly-feathers-validate';
import { hooks as feeds } from 'playing-feed-services';

import accepts from './user-mission-invite.accepts';
import notifiers from './user-mission-invite.notifiers';

export default function (options = {}) {
  return {
    before: {
      all: [
        hooks.authenticate('jwt', options.auth, 'scores,actions'),
        cache(options.cache)
      ],
      create: [
        hooks.addRouteObject('userMission', { service: 'user-missions' }),
        sanitize(accepts),
        validate(accepts),
      ],
      patch: [
        hooks.addRouteObject('userMission', { service: 'user-missions' }),
      ],
      remove: [
        hooks.addRouteObject('userMission', { service: 'user-missions' }),
      ]
    },
    after: {
      all: [
        hooks.populate('mission', { retained: false }),
        cache(options.cache),
        hooks.responder()
      ],
      patch: [
        feeds.notify('mission.invite.accept', notifiers),
      ],
      remove: [
        iff(hooks.isAction('reject'),
          feeds.notify('mission.invite.reject', notifiers))
      ]
    }
  };
}