import { iff, isProvider } from 'feathers-hooks-common';
import { associateCurrentUser, queryWithCurrentUser } from 'feathers-authentication-hooks';
import fp from 'mostly-func';
import { hooks } from 'mostly-feathers-mongoose';
import { cache } from 'mostly-feathers-cache';
import { validate } from 'mostly-feathers-validate';

import { populateTasks } from '../../hooks';
import UserMissionEntity from '../../entities/user-mission.entity';
import notifier from './user-mission.notifier';

const isLanes = (context) => async (val, params) => {
  const mission = await context.app.service('missions').get(params.mission);
  if (!fp.contains(val, mission.lanes || [])) return 'lane is not exists';
};

const defaultLane = async (app, missionId) => {
  const mission = await app.service('missions').get(missionId);
  return fp.find(fp.propEq('default', true), mission.lanes || []);
};

const accepts = (context) => {
  // rules
  const mission = { arg: 'mission', type: 'string',
    required: true, description: 'mission definition' };
  const access = { arg: 'access', type: 'string',
    validates: { isIn: { args: ['public', 'protected', 'private'], message: 'access is not valid' }, required: true },
    description: 'access of the mission' };
  const lane = { arg: 'lane', type: 'string',
    validates: { isLanes: isLanes(context) },
    description: 'lane of the mission' };

  return {
    create: [ mission, access, lane ]
  };
};

export default function (options = {}) {
  return {
    before: {
      all: [
        hooks.authenticate('jwt', options.auth, 'scores,actions'),
        cache(options.cache)
      ],
      create: [
        iff(isProvider('external'),
          associateCurrentUser({ idField: 'id', as: 'owner' })),
        validate(accepts),
        hooks.discardFields('tasks')
      ],
      update: [
        iff(isProvider('external'),
          associateCurrentUser({ idField: 'id', as: 'user' })),
        validate(accepts),
        hooks.discardFields('owner', 'tasks', 'createdAt', 'updatedAt', 'destroyedAt')
      ],
      patch: [
        iff(isProvider('external'),
          associateCurrentUser({ idField: 'id', as: 'user' })),
        validate(accepts),
        hooks.discardFields('owner', 'tasks', 'createdAt', 'updatedAt', 'destroyedAt')
      ]
    },
    after: {
      all: [
        hooks.populate('mission', { service: 'missions' }),
        hooks.populate('owner', { service: 'users' }),
        hooks.populate('performers.user', { service: 'users' }),
        populateTasks(),
        cache(options.cache),
        hooks.presentEntity(UserMissionEntity, options.entities),
        hooks.responder()
      ],
      create: [
        notifier('mission.create')
      ],
      patch: [
        iff(hooks.isAction('join'), notifier('mission.join')),
        iff(hooks.isAction('leave'), notifier('mission.leave')),
        iff(hooks.isAction('play'), notifier('mission.play')),
        iff(hooks.isAction('roles'), notifier('mission.role'))
      ],
      remove: [
        notifier('mission.delete')
      ]
    }
  };
}