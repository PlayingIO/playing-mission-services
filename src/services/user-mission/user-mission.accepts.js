import fp from 'mostly-func';
import { helpers } from 'mostly-feathers-validate';

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

export default function accepts (context) {
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
}
