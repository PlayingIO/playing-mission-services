import fp from 'mostly-func';
import { helpers } from 'mostly-feathers-validate';
import { defaultRoles, rolesExists } from '../../helpers';

export default function accepts (context) {
  const svcUserMissions = context.app.service('user-missions');
  const svcUsers = context.app.service('users');

  // validation rules
  const roles = { arg: 'roles', type: 'object',
    validates: {
      exists: rolesExists(svcUserMissions, 'id', 'Roles is invalid') },
    default: defaultRoles(svcUserMissions, 'id'),
    required: true, description: 'Role and lanes ' };

  const player = { arg: 'player', type: 'string',
    validates: {
      exists: helpers.idExists(svcUsers, 'player', 'Player is not exists') },
    required: true, description: 'Player' };
  const user = { arg: 'user', type: 'string', required: true, description: 'Current user' };

  const invite = { arg: 'invite', type: 'string', required: true, description: 'Invite id' };

  return {
    remove: [ invite ],
    create: [ user, player, roles ],
  };
}
