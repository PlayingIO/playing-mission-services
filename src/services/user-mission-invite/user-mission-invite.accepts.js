const fp = require('mostly-func');
const { helpers } = require('mostly-feathers-validate');
const { defaultRoles, rolesExists } = require('../../helpers');

module.exports = function accepts (context) {
  const svcUserMissions = context.app.service('user-missions');
  const svcUsers = context.app.service('users');

  // validation rules
  const roles = { arg: 'roles', type: 'object',
    validates: { exists: rolesExists(svcUserMissions, 'primary', 'Roles is invalid') },
    default: defaultRoles(svcUserMissions, 'primary'),
    required: true, description: 'Role and lanes ' };

  const player = { arg: 'player', type: 'string',
    validates: { exists: helpers.idExists(svcUsers, 'player', 'Player is not exists') },
    required: true, description: 'Player' };

  const invite = { arg: 'id', type: 'string', required: true, description: 'Invite id' };

  return {
    create: [ player, roles ],
    remove: [ invite ],
    reject: [ invite ]
  };
};
