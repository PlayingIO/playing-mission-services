import { hooks } from 'mostly-feathers-mongoose';
import { cache } from 'mostly-feathers-cache';

export default function (options = {}) {
  return {
    before: {
      all: [
        hooks.authenticate('jwt', options.auth),
        cache(options.cache)
      ],
      find: [
        hooks.primaryResource('userMission', { service: 'user-missions' }),
      ],
      patch: [
        hooks.primaryResource('userMission', { service: 'user-missions' }),
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