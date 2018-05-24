import fp from 'mostly-func';
import { helpers } from 'mostly-feathers-validate';
import { defaultLane, defaultRoles, rolesExists } from '../../helpers';

export default function accepts (context) {
  const svcMissionDesigns = context.app.service('mission-designs');
  const svcUserMissions = context.app.service('user-missions');
  const svcUsers = context.app.service('users');

  // validation rules
  const definition = { arg: 'definition', type: 'string',
    validates: { exists: helpers.idExists(svcMissionDesigns, 'definition', 'Mission definition is not exists') },
    required: true, description: 'Mission definition' };

  const access = { arg: 'access', type: 'string',
    validates: { isIn: helpers.isIn('access', ['PUBLIC', 'PROTECTED', 'PRIVATE']) },
    required: true, description: 'Access of the mission' };

  const lane = { arg: 'lane', type: 'string',
    validates: {
      exists: helpers.propExists(svcMissionDesigns, {
        id: 'definition', path: 'lanes', prop: 'name'
      }, 'Lane is not exists') },
    default: defaultLane(svcMissionDesigns, 'definition'),
    required: true, description: 'Lane of the mission' };
  const roles = { arg: 'roles', type: 'object',
    validates: { exists: rolesExists(svcUserMissions, 'id', 'Roles is invalid') },
    default: defaultRoles(svcUserMissions, 'id'),
    required: true, description: 'Role and lanes ' };

  const player = { arg: 'player', type: 'string',
    validates: { exists: helpers.idExists(svcUsers, 'player', 'Player is not exists') },
    required: true, description: 'Player' };

  return {
    create: [ definition, access, lane ],
    transfer: [ player, roles ]
  };
}
