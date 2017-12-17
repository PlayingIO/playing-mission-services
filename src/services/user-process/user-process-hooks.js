import { hooks as auth } from 'feathers-authentication';
import { hooks } from 'mostly-feathers-mongoose';
import UserProcessEntity from '~/entities/user-process-entity';

module.exports = function(options = {}) {
  return {
    before: {
      all: [
        auth.authenticate('jwt')
      ],
      get: [],
      find: [],
      create: [],
      update: [],
      patch: [],
      remove: [],
    },
    after: {
      all: [
        hooks.presentEntity(UserProcessEntity, options),
        hooks.responder()
      ]
    }
  };
};