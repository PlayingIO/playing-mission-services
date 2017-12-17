import Entity from 'mostly-entity';
import { entities as contents } from 'playing-content-services';

const UserProcessEntity = new Entity('UserProcess', {
  image: { using: contents.BlobEntity }
});

UserProcessEntity.excepts('updatedAt', 'destroyedAt');

export default UserProcessEntity.asImmutable();
