import Entity from 'mostly-entity';
import { entities as contents } from 'playing-content-services';

const MissionEntity = new Entity('Mission', {
  image: { using: contents.BlobEntity }
});

MissionEntity.excepts('updatedAt', 'destroyedAt');

export default MissionEntity.asImmutable();
