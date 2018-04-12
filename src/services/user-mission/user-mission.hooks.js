import { iff, isProvider } from 'feathers-hooks-common';
import { associateCurrentUser, queryWithCurrentUser } from 'feathers-authentication-hooks';
import fp from 'mostly-func';
import { hooks } from 'mostly-feathers-mongoose';
import { cache } from 'mostly-feathers-cache';
import { sanitize, validate, helpers } from 'mostly-feathers-validate';

import { populateTasks } from '../../hooks';
import UserMissionEntity from '../../entities/user-mission.entity';
import notifier from './user-mission.notifier';

const isLanes = (service, id) => async (val, params) => {
  const mission = await service.get(params[id]);
  if (!fp.find(fp.propEq('name', val, mission.lanes || []))) return 'lane is not exists';
};

const defaultLane = (service, id) => async (params) => {
  const mission = await service.get(params[id]);
  const lane = fp.find(fp.propEq('default', true), mission.lanes || []);
  return lane? lane.name : null;
};

const accepts = (context) => {
  const svcMission = context.app.service('missions');
  // rules
  const mission = { arg: 'mission', type: 'string',
    validates: { idExists: helpers.idExists(svcMission, 'mission', 'Mission is not exists') },
    required: true, description: 'Mission definition' };
  const access = { arg: 'access', type: 'string',
    validates: { isIn: { args: ['public', 'protected', 'private'], message: 'access is not valid' }, required: true },
    default: 'public',
    description: 'Access of the mission' };
  const lane = { arg: 'lane', type: 'string',
    validates: { isLanes: isLanes(svcMission, 'mission') },
    default: defaultLane(svcMission, 'mission'),
    description: 'Lane of the mission' };

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
        iff(isProvider('external'), associateCurrentUser({ idField: 'id', as: 'owner' })),
        sanitize(accepts),
        validate(accepts),
        hooks.discardFields('tasks')
      ],
      update: [
        iff(isProvider('external'), associateCurrentUser({ idField: 'id', as: 'user' })),
        sanitize(accepts),
        validate(accepts),
        hooks.discardFields('owner', 'tasks', 'createdAt', 'updatedAt', 'destroyedAt')
      ],
      patch: [
        iff(isProvider('external'), associateCurrentUser({ idField: 'id', as: 'user' })),
        sanitize(accepts),
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