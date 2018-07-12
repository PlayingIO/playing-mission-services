const Entity = require('mostly-entity');
const fp = require('mostly-func');
const { BlobEntity } = require('playing-content-common');

const UserMissionEntity = new Entity('UserMission', {
  image: { using: BlobEntity }
});

// show tasks not completed as triggers
UserMissionEntity.expose('triggers', { if: Entity.isPresent('tasks') }, obj => {
  return fp.reject(fp.propEq('state', 'COMPLETED'), obj.tasks);
});

UserMissionEntity.discard('_id');

module.exports = UserMissionEntity.freeze();
