import fp from 'mostly-func';
import { helpers } from 'mostly-feathers-validate';
import { defaultRoles, rolesExists } from '../../helpers';

export default function accepts (context) {
  const svcUserMissions = context.app.service('user-missions');
  const svcUsers = context.app.service('users');

  // validation rules
  const roles = { arg: 'roles', type: 'object',
    validates: { exists: rolesExists(svcUserMissions, 'primary', 'Roles is invalid') },
    default: defaultRoles(svcUserMissions, 'primary'),
    required: true, description: 'Role and lanes ' };

  const performer = { arg: 'id', type: 'string',
    validates: { exists: helpers.idExists(svcUsers, 'id', 'Performer is not exists') },
    required: true, description: 'Performer Id' };

  return {
    create: [ roles ],
    remove: [ performer ],
    kick: [ performer ]
  };
}
