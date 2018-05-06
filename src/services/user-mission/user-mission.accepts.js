import fp from 'mostly-func';
import { helpers } from 'mostly-feathers-validate';
import { defaultLane, defaultRoles, rolesExists } from '../../helpers';

export default function accepts (context) {
  const svcMissions = context.app.service('missions');
  const svcUserMissions = context.app.service('user-missions');
  const svcUsers = context.app.service('users');

  // validation rules
  const mission = { arg: 'mission', type: 'string',
    validates: { exists: helpers.idExists(svcMissions, 'mission', 'Mission is not exists') },
    required: true, description: 'Mission definition' };

  const access = { arg: 'access', type: 'string',
    validates: {
      isIn: helpers.isIn('access', ['PUBLIC', 'PROTECTED', 'PRIVATE']) },
    required: true, description: 'Access of the mission' };

  const lane = { arg: 'lane', type: 'string',
    validates: {
      exists: helpers.propExists(svcMissions, {
        id: 'mission', path: 'lanes', prop: 'name'
      }, 'Lane is not exists') },
    default: defaultLane(svcMissions, 'mission'),
    required: true, description: 'Lane of the mission' };
  const roles = { arg: 'roles', type: 'object',
    validates: { exists: rolesExists(svcUserMissions, 'id', 'Roles is invalid') },
    default: defaultRoles(svcUserMissions, 'id'),
    required: true, description: 'Role and lanes ' };

  const player = { arg: 'player', type: 'string',
    validates: { exists: helpers.idExists(svcUsers, 'player', 'Player is not exists') },
    required: true, description: 'Player' };
  const user = { arg: 'user', type: 'string', required: true, description: 'Current user' };

  const trigger = { arg: 'trigger', type: 'string', required: true, description: 'Id of trigger' };
  const scopes = { arg: 'scopes', type: 'array', default: [], description: 'Scopes of scores to be counted' };

  const requestId = { arg: 'requestId', type: 'string', required: true, description: 'Request id' };

  return {
    approval: [ requestId ],
    create: [ mission, access, lane ],
    play: [ trigger, user, scopes ],
    transfer: [ player, roles ]
  };
}
