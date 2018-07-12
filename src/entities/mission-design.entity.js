const Entity = require('mostly-entity');
const { BlobEntity } = require('playing-content-common');

const MissionEntity = new Entity('Mission', {
  image: { using: BlobEntity }
});

MissionEntity.discard('_id');

module.exports = MissionEntity.freeze();
