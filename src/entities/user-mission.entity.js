import Entity, { utils } from 'mostly-entity';
import fp from 'mostly-func';
import { entities as contents } from 'playing-content-services';

const UserMissionEntity = new Entity('UserMission', {
  image: { using: contents.BlobEntity }
});

// show tasks not completed as triggers
UserMissionEntity.expose('triggers', { if: utils.isPresent('tasks') }, obj => {
  return fp.reject(fp.propEq('state', 'COMPLETED'), obj.tasks);
});

UserMissionEntity.excepts('updatedAt', 'destroyedAt');

export default UserMissionEntity.asImmutable();
