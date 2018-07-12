const makeDebug = require('debug');
const { Service, createService } = require('mostly-feathers-mongoose');
const fp = require('mostly-func');
const MissionDesignModel = require('../../models/mission-design.model');
const defaultHooks = require('./mission-design.hooks');

const debug = makeDebug('playing:mission-services:mission-designs');

const defaultOptions = {
  name: 'mission-designs'
};

class MissionDesignService extends Service {
  constructor (options) {
    options = fp.assignAll(defaultOptions, options);
    super(options);
  }

  setup (app) {
    super.setup(app);
    this.hooks(defaultHooks(this.options));
  }
}

module.exports = function init (app, options, hooks) {
  options = { ModelName: 'mission-design', ...options };
  return createService(app, MissionDesignService, MissionDesignModel, options);
};
module.exports.Service = MissionDesignService;
