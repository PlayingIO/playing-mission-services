import fp from 'mostly-func';
import { helpers } from 'mostly-feathers-validate';

const rolesExists = (service, id, message) => async (val, params) => {
  const userMission = await service.get(params[id], { query: { $select: 'mission,*' } });
  const lanes = fp.keys(val), roles = fp.values(val);
  if (userMission && userMission.mission && userMission.mission.lanes) {
    if (fp.includesAll(lanes, fp.map(fp.prop('name'), userMission.mission.lanes))
      && fp.includesAll(roles, ['player', 'observer'])) return;
  }
  return message;
};

const defaultRoles = (service, id) => async (params) => {
  const userMission = await service.get(params[id], { query: { $select: 'mission,*' } });
  if (userMission && userMission.mission && userMission.mission.lanes) {
    const lane = fp.find(fp.propEq('default', true), userMission.mission.lanes);
    return lane? { [lane.name] : 'player' } : null;
  }
  return null;
};

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
