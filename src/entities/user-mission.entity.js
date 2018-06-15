import Entity, { utils } from 'mostly-entity';
import fp from 'mostly-func';
import { BlobEntity } from 'playing-content-common';

const UserMissionEntity = new Entity('UserMission', {
  image: { using: BlobEntity }
});

// show tasks not completed as triggers
UserMissionEntity.expose('triggers', { if: utils.isPresent('tasks') }, obj => {
  return fp.reject(fp.propEq('state', 'COMPLETED'), obj.tasks);
});

UserMissionEntity.discard('_id');

export default UserMissionEntity.asImmutable();
