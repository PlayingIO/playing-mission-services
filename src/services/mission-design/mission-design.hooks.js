import { hooks } from 'mostly-feathers-mongoose';
import fp from 'mostly-func';
import { cache } from 'mostly-feathers-cache';
import { hooks as rules } from 'playing-rule-services';

import MissionDesignEntity from '../../entities/mission-design.entity';
import { getRecursiveRequires, getRecursiveRewards } from '../../helpers';

const getActivityRequires = fp.reduce((arr, mission) => {
  return arr.concat(getRecursiveRequires('requires')(mission.activities || []));
}, []);

const getActivityNotifyRequires = fp.reduce((arr, mission) => {
  return arr.concat(getRecursiveRequires('notify.target.requires')(mission.activities || []));
}, []);

const getActivityRewards = fp.reduce((arr, mission) => {
  return arr.concat(getRecursiveRewards('rewards')(mission.activities || []));
}, []);

export default function (options = {}) {
  return {
    before: {
      all: [
        hooks.authenticate('jwt', options.auth),
        cache(options.cache)
      ],
      update: [
        hooks.discardFields('createdAt', 'updatedAt', 'destroyedAt')
      ],
      patch: [
        hooks.discardFields('createdAt', 'updatedAt', 'destroyedAt')
      ]
    },
    after: {
      all: [
        rules.populateRequires('activities.requires', getActivityRequires),
        rules.populateRequires('activities.notify.target.requires', getActivityNotifyRequires),
        rules.populateRewards('activities.rewards', getActivityRewards),
        rules.populateRequires('settings.requires'),
        cache(options.cache),
        hooks.presentEntity(MissionDesignEntity, options.entities),
        hooks.responder()
      ]
    }
  };
}