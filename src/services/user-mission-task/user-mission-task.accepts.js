import fp from 'mostly-func';
import { helpers } from 'mostly-feathers-validate';
import { defaultLane, defaultRoles, rolesExists } from '../../helpers';

export default function accepts (context) {
  // validation rules
  const trigger = { arg: 'trigger', type: 'string', required: true, description: 'Id of trigger' };
  const scopes = { arg: 'scopes', type: 'array', default: [], description: 'Scopes of scores to be counted' };

  return {
    create: [ trigger, scopes ]
  };
}
