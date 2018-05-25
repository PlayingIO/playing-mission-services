import { hooks } from 'mostly-feathers-mongoose';
import { cache } from 'mostly-feathers-cache';
import { sanitize, validate } from 'mostly-feathers-validate';

import accepts from './user-request.accepts';

export default function (options = {}) {
  return {
    before: {
      all: [
        hooks.authenticate('jwt', options.auth),
        cache(options.cache)
      ],
      remove: [
        sanitize(accepts),
        validate(accepts)
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