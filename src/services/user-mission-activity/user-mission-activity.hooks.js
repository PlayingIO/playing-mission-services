import { iff, isProvider } from 'feathers-hooks-common';
import { associateCurrentUser, queryWithCurrentUser } from 'feathers-authentication-hooks';
import { hooks } from 'mostly-feathers-mongoose';
import { cache } from 'mostly-feathers-cache';
import { entities as feedsEntities } from 'playing-feed-services';

export default function (options = {}) {
  return {
    before: {
      all: [
        hooks.authenticate('jwt', options.auth),
        cache(options.cache)
      ]
    },
    after: {
      all: [
        hooks.populate('actor', { retained: false }),
        hooks.populate('mission', { retained: false }),
        hooks.populate('object', { retained: false }),
        hooks.populate('target', { retained: false }),
        cache(options.cache),
        hooks.presentEntity(feedsEntities.activity, options.entities),
        hooks.responder()
      ]
    }
  };
}