import fp from 'mostly-func';
import { helpers } from 'mostly-feathers-validate';
import { defaultRoles, rolesExists } from '../../helpers';

export default function accepts (context) {
  // validation rules
  const request = { arg: 'id', type: 'string', required: true, description: 'Request id' };

  return {
    remove: [ request ]
  };
}
