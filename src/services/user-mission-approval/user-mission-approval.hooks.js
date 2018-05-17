import { iff } from 'feathers-hooks-common';
import { hooks } from 'mostly-feathers-mongoose';
import { cache } from 'mostly-feathers-cache';
import { hooks as feeds } from 'playing-feed-services';

import notifiers from './user-mission-approval.notifiers';

export default function (options = {}) {
  return {
    before: {
      all: [
        hooks.authenticate('jwt', options.auth),
        cache(options.cache)
      ],
      find: [
        hooks.addRouteObject('userMission', { service: 'user-missions' }),
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
        cache(options.cache),
        hooks.responder()
      ],
      patch: [
        feeds.notify('mission.accept', notifiers)
      ],
      remove: [
        iff(hooks.isAction('reject'),
          feeds.notify('mission.reject', notifiers))
      ]
    }
  };
}