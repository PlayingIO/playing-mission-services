import fp from 'mostly-func';
import { helpers } from 'mostly-feathers-validate';

const defaultLane = (service, id) => async (params) => {
  const mission = await service.get(params[id]);
  if (mission && mission.lanes) {
    const lane = fp.find(fp.propEq('default', true), mission.lanes);
    return lane? lane.name : null;
  }
  return null;
};

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
  const svcMissions = context.app.service('missions');
  const svcUserMissions = context.app.service('user-missions');
  const svcUsers = context.app.service('users');

  // validation rules
  const mission = { arg: 'mission', type: 'string',
    validates: {
      exists: helpers.idExists(svcMissions, 'mission', 'Mission is not exists') },
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
    validates: {
      exists: rolesExists(svcUserMissions, 'id', 'Roles is invalid') },
    default: defaultRoles(svcUserMissions, 'id'),
    required: true, description: 'Role and lanes ' };

  const player = { arg: 'player', type: 'string',
    validates: {
      exists: helpers.idExists(svcUsers, 'player', 'Player is not exists') },
    required: true, description: 'Player' };
  const user = { arg: 'user', type: 'string', required: true, description: 'Current user' };
  const playerOrUser = { arg: ['player', 'user'], type: 'string',
    validates: {
      exists: helpers.idExists(svcUsers, ['player', 'user'], 'Player is not exists'),
      atLeastOneOf: helpers.atLeastOneOf('player', 'user') },
    description: 'Player or current user' };

  const role = { arg: 'role', type: 'string',
    validates: {
      isIn: helpers.isIn('role', ['player', 'observer', 'false']) },
    default: 'player',
    required: true, description: 'Role of the player' };

  const trigger = { arg: 'trigger', type: 'string', required: true, description: 'Id of trigger' };
  const scopes = { arg: 'scopes', type: 'array', default: [], description: 'Scopes of scores to be counted' };
  
  const requestId = { arg: 'requestId', type: 'string', required: true, description: 'Request id' };

  return {
    approval: [ requestId ],
    create: [ mission, access, lane ],
    join: [ user, roles ],
    leave: [ user ],
    kick: [ player ],
    play: [ trigger, user, scopes ],
    roles: [ roles, playerOrUser, scopes ],
    transfer: [ player, roles ]
  };
}
