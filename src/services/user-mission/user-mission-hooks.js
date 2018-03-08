import { iff, isProvider } from 'feathers-hooks-common';
import { hooks as auth } from 'feathers-authentication';
import { associateCurrentUser, queryWithCurrentUser } from 'feathers-authentication-hooks';
import { hooks } from 'mostly-feathers-mongoose';
import UserMissionEntity from '~/entities/user-mission-entity';

module.exports = function(options = {}) {
  return {
    before: {
      all: [
        hooks.addParams({ $auth: { query: { $select: 'scores,actions,*' } } }),
        auth.authenticate('jwt')
      ],
      create: [
        iff(isProvider('external'),
          associateCurrentUser({ idField: 'id', as: 'owner' }))
      ],
      update: [
        iff(isProvider('external'),
          associateCurrentUser({ idField: 'id', as: 'user' })),
        hooks.discardFields('id', 'owner', 'createdAt', 'updatedAt', 'destroyedAt')
      ],
      patch: [
        iff(isProvider('external'),
          associateCurrentUser({ idField: 'id', as: 'user' })),
        hooks.discardFields('id', 'owner', 'createdAt', 'updatedAt', 'destroyedAt')
      ]
    },
    after: {
      all: [
        hooks.populate('mission', { service: 'missions' }),
        hooks.populate('owner', { service: 'users' }),
        hooks.populate('performers.user', { service: 'users' }),
        hooks.presentEntity(UserMissionEntity, options),
        hooks.responder()
      ]
    }
  };
};