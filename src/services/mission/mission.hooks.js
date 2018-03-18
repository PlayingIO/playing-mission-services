import { hooks } from 'mostly-feathers-mongoose';
import fp from 'mostly-func';
import { cache } from 'mostly-feathers-cache';
import { hooks as rules } from 'playing-rule-services';

import MissionEntity from '~/entities/mission.entity';
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

module.exports = function(options = {}) {
  return {
    before: {
      all: [
        hooks.authenticate('jwt', options.auth),
        cache(options.cache)
      ],
      update: [
        hooks.discardFields('id', 'createdAt', 'updatedAt', 'destroyedAt')
      ],
      patch: [
        hooks.discardFields('id', 'createdAt', 'updatedAt', 'destroyedAt')
      ]
    },
    after: {
      all: [
        rules.populateRequires('activities.requires', getActivityRequires),
        rules.populateRequires('activities.notify.target.requires', getActivityNotifyRequires),
        rules.populateRewards('activities.rewards', getActivityRewards),
        rules.populateRequires('settings.requires'),
        cache(options.cache),
        hooks.presentEntity(MissionEntity, options),
        hooks.responder()
      ]
    }
  };
};