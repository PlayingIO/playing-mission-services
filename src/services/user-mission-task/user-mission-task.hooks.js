import { hooks } from 'mostly-feathers-mongoose';
import { cache } from 'mostly-feathers-cache';
import { sanitize, validate } from 'mostly-feathers-validate';
import { hooks as feeds } from 'playing-feed-services';

import accepts from './user-mission-task.accepts';
import notifiers from './user-mission-task.notifiers';

export default function (options = {}) {
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
        validate(accepts),
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
}