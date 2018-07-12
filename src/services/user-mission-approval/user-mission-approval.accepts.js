module.exports = function accepts (context) {
  // validation rules
  const request = { arg: 'id', type: 'string', required: true, description: 'Request id' };

  return {
    patch: [ request ],
    remove: [ request ],
    reject: [ request ]
  };
};