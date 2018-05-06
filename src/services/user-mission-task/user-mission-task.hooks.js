import { hooks } from 'mostly-feathers-mongoose';
import { cache } from 'mostly-feathers-cache';

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