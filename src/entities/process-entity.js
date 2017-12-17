import Entity from 'mostly-entity';
import { entities as contents } from 'playing-content-services';

const ProcessEntity = new Entity('Process', {
  image: { using: contents.BlobEntity }
});

ProcessEntity.excepts('updatedAt', 'destroyedAt');

export default ProcessEntity.asImmutable();
