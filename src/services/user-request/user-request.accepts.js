export default function accepts (context) {
  // validation rules
  const request = { arg: 'id', type: 'string', required: true, description: 'Request id' };

  return {
    remove: [ request ]
  };
}
