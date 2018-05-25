export default function accepts (context) {
  // validation rules
  const trigger = { arg: 'trigger', type: 'string', required: true, description: 'Id of trigger' };
  const scopes = { arg: 'scopes', type: 'array', default: [], description: 'Scopes of scores to be counted' };

  return {
    create: [ trigger, scopes ]
  };
}
