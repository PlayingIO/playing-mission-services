const { hooks } = require('mostly-feathers-mongoose');
const fp = require('mostly-func');
const { cache } = require('mostly-feathers-cache');
const rules = require('playing-rule-common');

const MissionDesignEntity = require('../../entities/mission-design.entity');
const { getRecursiveRequires, getRecursiveRewards } = require('../../helpers');

const getActivityRequires = fp.reduce((arr, mission) => {
  return arr.concat(getRecursiveRequires('requires')(mission.activities || []));
}, []);

const getActivityNotifyRequires = fp.reduce((arr, mission) => {
  return arr.concat(getRecursiveRequires('notify.target.requires')(mission.activities || []));
}, []);

const getActivityRewards = fp.reduce((arr, mission) => {
  return arr.concat(getRecursiveRewards('rewards')(mission.activities || []));
}, []);

module.exports = function (options = {}) {
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
};