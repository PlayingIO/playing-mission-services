import { hooks as auth } from 'feathers-authentication';
import { hooks } from 'mostly-feathers-mongoose';
import MissionEntity from '~/entities/mission-entity';

module.exports = function(options = {}) {
  return {
    before: {
      all: [
        auth.authenticate('jwt')
      ],
      update: [
        hooks.discardFields('id', 'createdAt', 'updatedAt', 'destroyedAt')
      ],
      patch: [
        hooks.discardFields('id', 'createdAt', 'updatedAt', 'destroyedAt')
      ]
    },
    after: {
      all: [
        hooks.presentEntity(MissionEntity, options),
        hooks.responder()
      ]
    }
  };
};