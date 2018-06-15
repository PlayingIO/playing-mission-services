import Entity from 'mostly-entity';
import { BlobEntity } from 'playing-content-common';

const MissionEntity = new Entity('Mission', {
  image: { using: BlobEntity }
});

MissionEntity.discard('_id');

export default MissionEntity.asImmutable();
