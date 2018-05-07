import { hooks } from 'mostly-feathers-mongoose';
import { cache } from 'mostly-feathers-cache';
import { sanitize, validate } from 'mostly-feathers-validate';

import accepts from './user-mission-task.accepts';

export default function (options = {}) {
  return {
    before: {
      all: [
        hooks.authenticate('jwt', options.auth, 'scores,actions'),
        cache(options.cache)
      ],
      find: [
        hooks.primaryResource('userMission', { service: 'user-missions',
          select: 'mission.activities.requires,mission.activities.rewards,*' }),
      ],
      create: [
        hooks.primaryResource('userMission', { service: 'user-missions',
          select: 'mission.activities.requires,mission.activities.rewards,*' }),
        sanitize(accepts),
        validate(accepts),
      ]
    },
    after: {
      all: [
        cache(options.cache),
        hooks.responder()
      ]
    }
  };
}