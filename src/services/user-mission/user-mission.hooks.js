import { iff, isProvider } from 'feathers-hooks-common';
import { associateCurrentUser, queryWithCurrentUser } from 'feathers-authentication-hooks';
import { hooks } from 'mostly-feathers-mongoose';
import { cache } from 'mostly-feathers-cache';

import { populateTasks } from '~/hooks';
import UserMissionEntity from '~/entities/user-mission.entity';

module.exports = function(options = {}) {
  return {
    before: {
      all: [
        hooks.authenticate('jwt', options.auth, 'scores,actions'),
        cache(options.cache)
      ],
      create: [
        iff(isProvider('external'),
          associateCurrentUser({ idField: 'id', as: 'owner' })),
        hooks.discardFields('tasks')
      ],
      update: [
        iff(isProvider('external'),
          associateCurrentUser({ idField: 'id', as: 'user' })),
        hooks.discardFields('id', 'owner', 'tasks', 'createdAt', 'updatedAt', 'destroyedAt')
      ],
      patch: [
        iff(isProvider('external'),
          associateCurrentUser({ idField: 'id', as: 'user' })),
        hooks.discardFields('id', 'owner', 'tasks', 'createdAt', 'updatedAt', 'destroyedAt')
      ]
    },
    after: {
      all: [
        hooks.populate('mission', { service: 'missions' }),
        hooks.populate('owner', { service: 'users' }),
        hooks.populate('performers.user', { service: 'users' }),
        populateTasks(),
        cache(options.cache),
        hooks.presentEntity(UserMissionEntity, options),
        hooks.responder()
      ]
    }
  };
};