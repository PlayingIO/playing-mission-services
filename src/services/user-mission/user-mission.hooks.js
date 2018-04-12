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
  if (!fp.find(fp.propEq('name', val, mission.lanes))) return 'Lane is not exists';
};

const isUserLanes = (service, id) => async (val, params) => {
  const userMission = await service.get(params[id], { query: { $select: 'mission,*' } });
  if (!fp.find(fp.propEq('name', val, userMission.mission.lanes || []))) return 'Lane is not exists';
};

const defaultLane = (service, id) => async (params) => {
  const mission = await service.get(params[id]);
  const lane = fp.find(fp.propEq('default', true), mission.lanes || []);
  return lane? lane.name : null;
};

const accepts = (context) => {
  const svcMissions = context.app.service('missions');
  const svcUserMissions = context.app.service('user-missions');
  const svcUsers = context.app.service('users');

  // validations
  const mission = { arg: 'mission', type: 'string',
    validates: { idExists: helpers.idExists(svcMissions, 'mission', 'Mission is not exists') },
    required: true, description: 'Mission definition' };
  const access = { arg: 'access', type: 'string',
    validates: { isIn: { args: ['public', 'protected', 'private'], message: 'access is not valid' }, required: true },
    description: 'Access of the mission' };
  const lane = { arg: 'lane', type: 'string',
    validates: { isLanes: isLanes(svcMissions, 'mission') },
    default: defaultLane(svcMissions, 'mission'),
    description: 'Lane of the mission' };
  const userLane = { arg: 'lane', type: 'string',
    validates: { isUserLanes: isUserLanes(svcUserMissions, '$id') },
    default: defaultLane(svcUserMissions, '$id'),
    description: 'Lane of the mission' };
  const player = { arg: ['player', 'user'], type: 'string',
    validates: {
      idExists: helpers.idExists(svcUsers, ['player', 'user'], 'Player is not exists'),
      atLeastOneOf: helpers.atLeastOneOf('player', 'user') },
    description: 'Player' };
  const role = { arg: 'role', type: 'string',
    validates: { isIn: { args: ['player', 'observer', 'false'], message: 'role is not valid' }, required: true },
    description: 'Role of the player' };

  return {
    create: [ mission, access, lane ],
    join: [ access, userLane, player, role ]
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