import Entity from 'mostly-entity';
import { entities as contents } from 'playing-content-services';

const UserMissionEntity = new Entity('UserMission', {
  image: { using: contents.BlobEntity }
});

UserMissionEntity.excepts('updatedAt', 'destroyedAt');

export default UserMissionEntity.asImmutable();
