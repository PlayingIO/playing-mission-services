import { hooks as auth } from 'feathers-authentication';
import { hooks } from 'mostly-feathers-mongoose';
import fp from 'mostly-func';
import { hooks as rules } from 'playing-rule-services';

import MissionEntity from '~/entities/mission-entity';
import { getActivityRequires, getActivityRewards } from '../../helpers';

const reduceActivityRequires = fp.reduce((arr, mission) => {
  return arr.concat(getActivityRequires(mission.activities || []));
}, []);

const reduceActivityRewards = fp.reduce((arr, mission) => {
  return arr.concat(getActivityRewards(mission.activities || []));
}, []);

module.exports = function(options = {}) {
  return {
    before: {
      all: [
        auth.authenticate('jwt')
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
        rules.populateRequires('activities.requires', reduceActivityRequires),
        rules.populateRewards('activities.rewards', reduceActivityRewards),
        hooks.presentEntity(MissionEntity, options),
        hooks.responder()
      ]
    }
  };
};